import {
    AccessControlUtils,
    Dispatcher,
    Log,
    QualityCheckService,
    QueryBuilder,
    RapidApiInfoService,
    RolesMiddleware
} from '../services';
import {CameraSchema, QualityCheckSchema, SettingSchema} from '../db-schema';
import HttpStatus from 'http-status-codes';
import {Router} from './router';
import passport from 'passport';
import {Express} from 'express';
import Promise from 'bluebird';
import {ObjectId} from 'mongodb';
import {AuthorizationType, CameraModel, ResourceType} from '../model';
import formidable from 'formidable';

export interface DatesRange {
    start: Date;
    end: Date;
}

export class ComplaintsRouter extends Router {
    static register(app: Express) {

        app.get('/complaints', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.QualityCheckComplains]), (req, res, next) => {
                let query: any;
                query = {$and: [AccessControlUtils.getOwnershipQuery(req, true)]};
                if (['cameraId', 'period', 'timeRange', 'country', 'city', 'address', 'complaintsProblem'].some(
                    element => Object.keys(req.query).includes(element))) {
                    let range: DatesRange;
                    for (let key in req.query) {
                        let queryKey = req.query[key];
                        switch (key) {
                            case 'country':
                                query['$and'].push({country: {$eq: queryKey}});
                                break;
                            case 'city':
                                query['$and'].push({city: {$eq: queryKey}});
                                break;
                            case 'address':
                                query['$and'].push({address: {$eq: queryKey}});
                                break;
                            case 'cameraId':
                                const cameraId = new ObjectId(queryKey);
                                query['$and'].push({cameraId: {$eq: cameraId}});
                                break;
                            case 'complaintsProblem':
                                if (queryKey !== 'without-problems') {
                                    query['$and'].push({complaintsProblem: {$eq: queryKey}});
                                }
                                break;
                            case 'period':
                                range = JSON.parse(queryKey);
                                if (!range.end || !range.start) {
                                    break;
                                }
                                if (range.start) {
                                    range.start = new Date(range.start);
                                }
                                if (range.end) {
                                    range.end = new Date(range.end);
                                    range.end.setHours(23);
                                    range.end.setMinutes(59);
                                    range.end.setSeconds(59);
                                }
                                query['$and'].push({timestamp: {$gte: range.start, $lte: range.end}});
                                break;
                            case 'timeRange':
                                const timeRange = JSON.parse(queryKey);
                                if (!timeRange.end || !timeRange.start) {
                                    break;
                                }
                                if (query.locationDate) delete query.locationDate;
                                query.$or = QueryBuilder.filterForTimeRange(timeRange, range, 'timestamp');
                                break;
                            default:
                                break;
                        }
                    }
                }
                if (req.query.complaintsProblem && req.query.complaintsProblem === 'without-problems') {
                    query['$and'].push({$or: [{complaintsProblem: {$exists: false}}, {complaintsProblem: null}]});
                }
                let limit = +req.query.limit;
                let skip = +req.query.offset;
                Promise.all([
                    QualityCheckSchema.find(query).skip(skip).limit(limit).sort({timestamp: -1}),
                    QualityCheckSchema.countDocuments(query)
                ]).then(([qualityChecks, total]) => {
                    let cameraIds = qualityChecks.map(cameraComplaint => {
                        return cameraComplaint.toJSON().cameraId;
                    });
                    return Promise.all([
                        qualityChecks,
                        CameraSchema.find({_id: {$in: cameraIds}}).then(cameras => {
                            let camerasMap = {};
                            cameras.forEach(camera => {
                                let cameraModel = CameraModel.fromDb(camera);
                                camerasMap[cameraModel.id] = cameraModel;
                            });
                            let predictionsMap = qualityChecks.map(cameraComplaint => {
                                let cameraComplaintMap = cameraComplaint.toJSON();
                                return {
                                    cameraModel: camerasMap[cameraComplaintMap.cameraId.toString()],
                                    predictions: cameraComplaintMap.foundCarsJSON,
                                    id: cameraComplaintMap._id.toString()
                                };
                            });
                            return Dispatcher.findSpotsForComplaints(predictionsMap);
                        }),
                        total
                    ]);
                }).then(([qualityChecks, predictionsMap, total]) => {
                    let records = qualityChecks.map(qualityCheck => {
                        let quality = qualityCheck.toJSON();
                        quality.drawSpotsJSON = predictionsMap[quality._id.toString()];
                        return quality;
                    });
                    res.send({records, total});
                }).catch(next);
            }
        );

        app.delete('/complaints/:id', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.QualityCheckComplains]), (req, res, next) => {
                QualityCheckSchema.findById(req.params.id).then(complaint => {
                    let complaintJson = complaint.toJSON();
                    complaint.remove();
                    return complaintJson;
                }).then((complaint) => {
                    QualityCheckService.googleStorageDelete(complaint.snapshotUrl.split('/').pop());
                    res.status(HttpStatus.OK).end();
                }).catch(next);
            });

        app.delete('/complaints', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.QualityCheckComplains]), async (req, res) => {
                let cameraIds = req.query.cameraIds;
                if (!Array.isArray(cameraIds)) {
                    cameraIds = [cameraIds];
                }
                let complaints = await QualityCheckSchema.find({cameraId: {$in: cameraIds}});
                for (let i = 0; i < complaints.length; i++) {
                    let complaint = complaints[i];
                    await complaint.remove();
                    await QualityCheckService.googleStorageDelete(complaint.toJSON().snapshotUrl.split('/').pop())
                        .catch(err => {
                            Log.error(`[complaints./complaints] Err[${err}]`);
                        });
                }
                res.status(HttpStatus.OK).end();
            });

        app.get('/complaints/downloads', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.QualityCheckComplains]), async (req, res) => {
                Log.info(`[complaints./complaints/downloads] Start for cameras[${req.query.cameraIds}]`);
                req.connection.setTimeout(1000 * 60 * 20);//20 min
                let cameraIds = req.query.cameraIds;
                let periodDates = req.query.period;
                let timeRange = req.query.timeRange;
                let correctMarking = req.query.correctMarking;
                let query = this.buildQuery(cameraIds, periodDates, timeRange, correctMarking);
                let complaints = await QualityCheckSchema.find(query) || [];
                let folderName = 'complaints-' + Date.now();
                Promise.map(complaints, (complaint) => {
                    let complaintModel = complaint.toJSON();
                    return QualityCheckService.googleStorageDownLoad(folderName,
                        complaintModel.snapshotUrl.split('/').pop()).catch(err => {
                        Log.error(
                            `[complaints./complaints/downloads] Error[${err}] for cameras[${req.query.cameraIds}]`);
                    });
                }, {concurrency: 5}).then(() => {
                    return QualityCheckService.zipFolder(folderName);
                }).then((zipPath: string) => {
                    res.sendFile(zipPath, () => {
                        QualityCheckService.clearTempDir(folderName);
                    });
                });
            });

        app.get('/complaints/problems', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.Admin]), async (req, res) => {
                let query: any;
                query = {$and: [AccessControlUtils.getOwnershipQuery(req, true)]};
                if (['cameraId', 'period', 'timeRange', 'country', 'city', 'address'].some(
                    element => Object.keys(req.query).includes(element))) {
                    let range: DatesRange;
                    for (let key in req.query) {
                        let queryKey = req.query[key];
                        switch (key) {
                            case 'country':
                                query['$and'].push({country: {$eq: queryKey}});
                                break;
                            case 'city':
                                query['$and'].push({city: {$eq: queryKey}});
                                break;
                            case 'address':
                                query['$and'].push({address: {$eq: queryKey}});
                                break;
                            case 'cameraId':
                                const cameraId = new ObjectId(queryKey);
                                query['$and'].push({cameraId: {$eq: cameraId}});
                                break;
                            case 'period':
                                range = JSON.parse(queryKey);
                                if (!range.end || !range.start) {
                                    break;
                                }
                                if (range.start) {
                                    range.start = new Date(range.start);
                                }
                                if (range.end) {
                                    range.end = new Date(range.end);
                                    range.end.setHours(23);
                                    range.end.setMinutes(59);
                                    range.end.setSeconds(59);
                                }
                                query['$and'].push({timestamp: {$gte: range.start, $lte: range.end}});
                                break;
                            case 'timeRange':
                                const timeRange = JSON.parse(queryKey);
                                if (!timeRange.end || !timeRange.start) {
                                    break;
                                }
                                if (query.locationDate) delete query.locationDate;
                                query.$or = QueryBuilder.filterForTimeRange(timeRange, range, 'timestamp');
                                break;
                            default:
                                break;
                        }
                    }
                }
                return SettingSchema.aggregate(
                    [{$match: {'category': 'complaintsProblem'}},
                        {$group: {_id: '$key', value: {'$first': '$value'}}}])
                    .then((settings) => {
                        QualityCheckSchema.aggregate(
                            [{$match: query},
                                {$match: {complaintsProblem: {$in: settings.map(setting => setting._id)}}},
                                {$group: {_id: '$complaintsProblem', count: {$sum: 1}}}])
                            .then((complaintsProblems) => {
                                res.send(complaintsProblems);
                            });
                    });
            });

        app.put('/complaint-problem/:id', passport.authenticate(AuthorizationType.Custom, {session: false}),
            RolesMiddleware.checkRoles([ResourceType.QualityCheckComplains]), (req, res, next) => {
                return QualityCheckSchema.findOneAndUpdate({_id: req.params.id},
                    {'complaintsProblem': req.body.complaintsProblem})
                    .then(() => {
                        res.status(HttpStatus.OK).end();
                    }).catch(next);
            });
        //ml server rout
        app.post('/public-api-save', (req, res, next) => {
            Log.info('[public-api-save] Request host: [' + req.host + ']');
            const form = new formidable.IncomingForm();
            form.parse(req, (err, fields) => {
                RapidApiInfoService.storeAll(fields).then(() => {
                    res.status(HttpStatus.OK).end();
                }).catch(next);
            })
        });
    }

    static buildQuery(cameraIds: string, periodDates: string, timeRange: string, correctMarking: boolean): object {
        const query = {} as any;
        let range: DatesRange;
        if (cameraIds) {
            query.cameraId = {$in: JSON.parse(cameraIds)};
        }
        if (correctMarking) {
            query.correctMarking = {$eq: correctMarking};
        }

        if (periodDates) {
            range = JSON.parse(periodDates);
            if (range.start) {
                range.start = new Date(range.start);
            }
            if (range.end) {
                range.end = new Date(range.end);
                range.end.setHours(23);
                range.end.setMinutes(59);
                range.end.setSeconds(59);
            }
            query.timestamp = {$gte: range.start, $lte: range.end};
        }
        if (timeRange) {
            timeRange = JSON.parse(timeRange);
            if (query.timestamp) delete query.timestamp;
            query.$or = QueryBuilder.filterForTimeRange(timeRange, range);
        }
        return query;
    }
}
