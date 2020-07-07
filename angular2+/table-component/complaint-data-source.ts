import { LocalDataSource } from 'ng2-smart-table';
import { ComplaintService } from '../../@core/services/complaint.service';
import { Injectable } from '@angular/core';
import { Complaint } from '../../@core/data/complaint';

@Injectable()
export class ComplaintDataSource extends LocalDataSource {
  protected lastRequestCount: number = 0;
  cameraIds: string[];
  cameraId?: string;
  period: { start: string; end?: string };
  timeRange: { start: number; end: number };
  complaintsProblem: string;
  country: string;
  city: string;
  address: string;
  isFilter: boolean = false;
  skipInitialRequest: boolean;

  constructor(private service: ComplaintService) {
    super();
  }

  count(): number {
    return this.lastRequestCount;
  }

  remove(element: any): Promise<any> {
    this.data = this.data.filter(el => {
      return el !== element;
    });
    return this.service.delete(element._id).then(() => {
      return super.remove(element);
    });
  }

  getElements(): Promise<Complaint[]> {
    return this.requestElements().then(res => {
      this.isFilter = false;
      this.lastRequestCount = res.total;
      this.data = res.records;
      return this.data;
    });
  }

  protected requestElements(): Promise<any> {
    const limit = this.pagingConf['perPage'];
    const offset = (this.pagingConf['page'] - 1) * limit;
    if (this.skipInitialRequest) {
      this.skipInitialRequest = false;
      return Promise.resolve({
        limit,
        offset,
        records: [],
        total: Number.MAX_SAFE_INTEGER // to allow any page
      });
    }
    if (this.period && !this.period.end) {
      this.period.end = this.period.start;
    }
    return this.service.getComplaints({
      limit,
      offset,
      cameraId: this.cameraId,
      period: this.period,
      timeRange: this.timeRange,
      complaintsProblem: this.complaintsProblem,
      country: this.country,
      city: this.city,
      address: this.address
    });
  }
}
