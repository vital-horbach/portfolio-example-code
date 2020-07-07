import {CameraSchema, QualityCheckSchema, ParkingSchema} from '../db-schema';
import {CameraModel, ParkingModel} from '../model';
import {Detector} from './detector';
import {Log} from './logger';
import {Dispatcher} from './dispatcher';
import {GoogleStorageService} from './google-storage';
import Promise from 'bluebird';
import {SmallMathOperations} from '../utils';
import fse from 'fs-extra';
import os from 'os';
import path from 'path';
import {zip} from 'zip-a-folder';
import config from '../config';

const ZIP_FOLDER = 'zip';
const FILES_FOLDER = 'files';

export class QualityCheckService {
    constructor() {

    }

    static async cleanup() {
        let cameras = await CameraSchema.find({}).exec();
        for (let camera of cameras) {
            try {
                Log.debug(`[quality-check.cleanup] Start for camera[${camera._id}]`);
                const length = await this.cleanupForCamera(camera);
                Log.debug(`[quality-check.cleanup] Finish for camera[${camera._id}] [${length}] quality deleted`);
            } catch (e) {
                Log.error(`[quality-check.cleanup] Error[${e}]`);
            }
        }
    }

    static async cleanupForCamera(camera) {
        let qualityChecks = await (QualityCheckSchema.find({
            $and: [
                {cameraId: camera._id},
                {timestamp: {$lt: new Date(Date.now() - camera.keepQualityCheckPeriod)}},
                {
                    $or: [
                        {complaintsProblem: {$exists: false}},
                        {
                            $and: [
                                {complaintsProblem: {$exists: true}},
                                {complaintsProblem: null}
                            ]
                        }
                    ]
                }
            ]
        }).exec() as any);
        for (let qualityCheck of qualityChecks) {
            await qualityCheck.delete();
            await QualityCheckService.googleStorageDelete(qualityCheck.snapshotUrl.split('/').pop()).catch(err => {
                Log.error(`[quality-check./cleanupForCamera] Err[${err}]`);
            });
        }
        return qualityChecks.length;
    }

    static async storeAll() {
        let cameras = await CameraSchema.find({active: true}).exec().map(CameraModel.fromDb);
        for (let camera of cameras) {
            try {
                if (!camera.keepQualityCheckPeriod) {
                    return;
                }
                await this.saveCameraInfo(camera);
            } catch (e) {
                Log.error(`[quality-check.storeAll] Error[${e}]`);
            }
        }
    }

    static async saveCameraInfo(camera) {
        let params = await Dispatcher.getImageUrl(camera);
        let prediction = await Detector.detect(params, {viewType: camera.viewType, hint: `QualityCheckService.saveCameraInfo for: [${camera.id}]`}, true, camera.nightMode);
        let {snapshotUrl, drawSpotsJSON, parkingDocument} = await Promise.props({
            snapshotUrl: this.googleStorageSave(Buffer.from(prediction.snapshot, 'base64'), camera),
            drawSpotsJSON: Dispatcher.getJsonById(camera.id),
            parkingDocument: ParkingSchema.findOne({cameras: camera.id})
        });
        if (!parkingDocument) {
            Log.warn(`[quality-check.saveCameraInfo] Camera doesn't belong to parking[${camera.id}]`);
            return;
        }
        const parkingModel = ParkingModel.fromDb(parkingDocument);
        let carsFindZone = {zone: camera.mappingCoordinates.picturePoints};
        let spotComplain = new QualityCheckSchema({
            cameraId: camera.id,
            snapshotUrl,
            foundCarsJSON: prediction.detections,
            drawSpotsJSON: drawSpotsJSON[camera.id],
            carsFindZone,
            country: parkingModel.country,
            city: parkingModel.city,
            address: parkingModel.address,
            contacts: parkingModel.contacts
        });
        return spotComplain.save();
    }

    static async googleStorageSave(buffer, camera) {
        const bucketUpload = GoogleStorageService.getStorage().bucket(config.googleStorage.qualityCheck);
        let fileName = camera.id + '_' + SmallMathOperations.fileNameFormatDate(new Date()) + '.jpg';
        const file = bucketUpload.file(fileName);
        return new Promise((resolve, reject) => {
            file.save(buffer, {
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {custom: "metadata"}
                }
            }, function (err) {
                if (err) {
                    return reject(err);
                }
                let snapshotUrl = 'https://storage.googleapis.com/' + config.googleStorage.qualityCheck + '/' + fileName;
                Log.debug(`[quality-check.googleStorageSave] success get snapshot from ${camera.id}`);
                resolve(snapshotUrl)
            });
        })
    }

    static async googleStorageDelete(filename) {
        await GoogleStorageService.getStorage().bucket(config.googleStorage.qualityCheck)
            .file(filename)
            .delete();
    }

    static async googleStorageDownLoad(folderName, filePath) {
        const folder = filePath.split('_')[0];
        const fileName = filePath.split('_')[1];
        await fse.ensureDir(path.join(os.tmpdir(), folderName, FILES_FOLDER, folder));
        return await GoogleStorageService.getStorage().bucket(config.googleStorage.qualityCheck)
            .file(filePath)
            .download({destination: path.join(os.tmpdir(), folderName, FILES_FOLDER, folder, fileName)});
    }

    static async clearTempDir(folderName) {
        return fse.remove(path.join(os.tmpdir(), folderName));
    }

    static async zipFolder(folderName) {
        const zipPath = path.join(os.tmpdir(), folderName, FILES_FOLDER);
        await fse.ensureDir(path.join(os.tmpdir(), folderName, ZIP_FOLDER));
        const filePath = path.join(os.tmpdir(), folderName, ZIP_FOLDER, `load.zip`);
        await zip(zipPath, filePath);
        return filePath;
    }
}
