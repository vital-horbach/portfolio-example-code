import { Component, OnInit } from '@angular/core';
import { ComplaintDataSource } from './complaint-data-source';
import { CanvasElementComponent } from './canvas-element/canvas-element.component';
import { MapElementComponent } from './map-element/map-element.component';
import { DatePipe } from '@angular/common';
import { ComplaintService } from '../../@core/services/complaint.service';
import { ParkingService } from '../../@core/services/parking.service';
import { Parking } from '../../@core/data/parking';
import { PropsCameraComponent } from './props-camera/props-camera.component';
import { NbCalendarRange } from '@nebular/theme';
import { ChangeContext } from 'ng5-slider';
import { PageStateService } from '../../@core/utils/page-state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { SettingsTableService } from '../settings/settings-table.service';
import { getCodeByCountryName, getCountryNameByCode } from '../../../assets/data/countries';

const COUNT_ELEMENT_LIST = [5, 10, 15, 20];
const OBJECT_ID_LENGTH = 24;

interface ParkingAddress {
  country?: string;
  city?: string;
  address?: string;
}

export interface SearchComplaintsObject {
  country?: string;
  city?: string;
  address?: string;
  cameraId?: string;
  periodDate?: { start: string; end?: string };
  periodTime?: { start: number; end: number };
}

@Component({
  selector: 'ngx-complain',
  styleUrls: ['./complaint.component.scss'],
  templateUrl: './complaint.component.html',
  providers: [SettingsTableService]
})
export class ComplaintComponent implements OnInit {
  settings = {
    pager: {
      display: true,
      perPage: 5
    },
    actions: {
      add: false,
      edit: false
    },
    delete: {
      deleteButtonContent: '<i class="nb-trash"></i>',
      confirmDelete: true
    },
    columns: {
      _id: {
        title: 'Picture',
        type: 'custom',
        renderComponent: CanvasElementComponent,
        editable: false,
        addable: false,
        filter: false,
        width: '50%'
      },
      cameraId: {
        title: 'Map',
        type: 'custom',
        renderComponent: MapElementComponent,
        editable: false,
        addable: false,
        filter: false,
        width: '35%'
      },
      info: {
        title: 'Info',
        type: 'custom',
        renderComponent: PropsCameraComponent,
        editable: false,
        addable: false,
        filter: false,
        width: '15%'
      }
    }
  };

  source: ComplaintDataSource;
  countElementList: number[] = COUNT_ELEMENT_LIST;
  countOnPage: number = 5;
  parkings: Parking[];
  cameraIds: string[] = [];
  cameraId: string;
  parking: Parking = null;
  isLoading: boolean = false;
  searchObj: SearchComplaintsObject = {};
  parkingCountries: string[] = [];
  parkingCities: string[] = [];
  parkingStreets: string[] = [];
  complaintsProblem: string;
  complaintsProblems: { key: string; value: string }[] = [];
  jsonSearchObj: string;

  constructor(
    private complaintService: ComplaintService,
    private settingsService: SettingsTableService,
    private datePipe: DatePipe,
    private parkingService: ParkingService,
    private pageStateService: PageStateService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.source = new ComplaintDataSource(complaintService);
    this.restoreUrlParams();
    this.pageStateService.setParamsInUrl(this.source, this.router);
  }

  ngOnInit(): void {
    this.loadParkings();
    this.complaintService.getComplaintsProblems().then((result: any) => {
      this.complaintsProblems = result;
    });
  }

  restoreUrlParams(): void {
    const params = this.route.snapshot.queryParams;
    const page = params['page'] || 1;
    if (page) {
      this.source.skipInitialRequest = true;
    }
    this.source
      .onChanged()
      .pipe(first())
      .subscribe(() => {
        this.source.setPage(+page);
      });
  }

  loadParkings() {
    const parkingPromise = this.parkingService.getAllParkings();
    this.isLoading = true;
    parkingPromise
      .then(req => {
        this.parkings = req.records;
        return req.records;
      })
      .then(parkings => {
        const getParkingPropArray = (property: string) => {
          return parkings.map(park => park[property]);
        };
        this.parkingCountries = Array.from(new Set(getParkingPropArray('country'))).sort();
        this.parkingCities = Array.from(new Set(getParkingPropArray('city'))).sort();
        this.parkingStreets = Array.from(new Set(getParkingPropArray('address'))).sort();
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  async search() {
    if (this.searchObj.cameraId && this.searchObj.cameraId.length === OBJECT_ID_LENGTH) {
      this.source.cameraId = this.searchObj.cameraId;
    }
    if (!this.searchObj.cameraId) {
      this.source.cameraId = null;
    }
    this.source.period = this.searchObj.periodDate;
    this.source.timeRange = this.searchObj.periodTime;
    this.source.isFilter = true;
    this.source.country = getCodeByCountryName(this.searchObj.country);
    this.source.city = this.searchObj.city;
    this.source.address = this.searchObj.address;
    this.source.complaintsProblem = this.complaintsProblem;
    this.source.setPaging(1, this.countOnPage);
  }

  getPeriodDate(period: NbCalendarRange<Date>) {
    if (period.end) period.end.setHours(23, 59, 59);
    this.searchObj.periodDate = {
      start: this.datePipe.transform(period.start, 'yyyy-MM-dd'),
      end: this.datePipe.transform(period.end, 'yyyy-MM-dd')
    };
  }

  getPeriodTime(timeRange: ChangeContext) {
    const { value: start, highValue: end } = timeRange ? timeRange : { value: 0, highValue: 0 };
    this.searchObj.periodTime = { start: start, end: end };
  }

  onDeleteConfirm(event): void {
    event.confirm.resolve();
  }

  deleteForCameras() {
    let cameraIds = [];
    if (this.parking) {
      if (this.cameraId) {
        cameraIds = [this.cameraId];
      } else {
        cameraIds = this.parking.cameras;
      }
    }
    return this.complaintService.deleteForCameras(cameraIds).then(() => {
      return this.source.refresh();
    });
  }

  onSelectedChanged(
    country?: string | { $ngOptionValue: null; $ngOptionLabel: string; disabled: boolean },
    city?: string | { $ngOptionValue: null; $ngOptionLabel: string; disabled: boolean },
    street?: string | { $ngOptionValue: null; $ngOptionLabel: string; disabled: boolean }
  ) {
    if (typeof country !== 'string') {
      country = null;
    }
    if (country) {
      this.parkingCities = [];
      this.parkingStreets = [];
      this.cameraIds = [];
      if (!street) {
        this.searchObj.address = null;
        this.searchObj.cameraId = null;
      }
      if (!city) {
        this.searchObj.city = null;
      }
      const filteredByCountry = this.parkings.filter((c: ParkingAddress) => {
        return c.country === country;
      });
      this.parkingCities = Array.from(
        new Set(filteredByCountry.map((c: ParkingAddress) => c.city))
      );
    }
    if (typeof city !== 'string') {
      city = null;
    }
    if (city) {
      const filteredByCity = this.parkings.filter((c: ParkingAddress) => {
        return c.city === city;
      });
      this.parkingStreets = Array.from(
        new Set(filteredByCity.map((c: ParkingAddress) => c.address))
      );
      if (street) {
        this.searchObj.cameraId = '';
        const foundComplaint = filteredByCity.filter(p => p.address === street);
        this.parking = foundComplaint[0];
        this.cameraIds = this.parking.cameras;
      }
    }
    if (typeof street !== 'string') {
      street = null;
    }
    if (street) {
      this.cameraIds = [];
      this.searchObj.cameraId = '';
      const foundComplaint = this.parkings.filter(p => p.address === street);
      this.parking = foundComplaint[0];
      this.cameraIds = this.parking.cameras;
    }
  }

  downloadSnapshots(): void {
    let sendCameraIds: string[];
    if (!!this.searchObj.cameraId) {
      sendCameraIds = [this.searchObj.cameraId];
    } else {
      sendCameraIds = this.cameraIds;
    }
    this.source.cameraIds = this.cameraIds;
    this.source.period = this.searchObj.periodDate;
    this.source.timeRange = this.searchObj.periodTime;
    this.complaintService
      .getSnapshots({
        cameraIds: sendCameraIds,
        period: this.source.period,
        timeRange: this.source.timeRange
      })
      .then(file => {
        const b: any = new Blob([file], { type: 'application/zip' });
        const url = window.URL.createObjectURL(b);
        const link = document.createElement('a');
        link.href = url;
        link.download = `complaints-${new Date().toISOString()}.zip`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isLoading = false;
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  getCountryNameByCode(code: string) {
    if (code === 'null') {
      return 'All';
    }
    return getCountryNameByCode(code);
  }
  navigateProblemsPage() {
    this.jsonSearchObj = JSON.stringify(this.searchObj);
    this.router.navigate(['/pages/complaints-problems'], {
      queryParams: { jsonSearchObj: this.jsonSearchObj }
    });
  }
}
