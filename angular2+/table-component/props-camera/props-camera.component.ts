import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComplaintService } from '../../../@core/services/complaint.service';
import { CamerasTableService } from '../../cameras/cameras-table.service';
import { getCountryNameByCode } from '../../../../assets/data/countries';

@Component({
  selector: 'ngx-props-camera',
  template: `
    <dl>
      <dt>Camera ID:</dt>
      <dd>
        <a (click)="getImageByCameraId($event, rowData.cameraId)" href="#">{{
          rowData.cameraId
        }}</a>
      </dd>
      <dd>
        <a href="#/pages/cameras/camera-edit?id={{ rowData.cameraId }}">Edit camera</a>
      </dd>
      <dt>Country:</dt>
      <dd>{{ rowData.country }}</dd>
      <dt>City</dt>
      <dd>{{ rowData.city }}</dd>
      <dt>Address</dt>
      <dd>{{ rowData.address }}</dd>
      <dt>Date</dt>
      <dd>{{ rowData.timestamp }}</dd>
      <dt>Select a problem</dt>
      <dd>
        <select
          class="form-control"
          id="parkingProblem"
          [ngModel]="rowData.complaintsProblem"
          (change)="onProblemsSelectedChanged($event, rowData._id)"
        >
          <option [value]="null" class="mainOptionSelect">Without problems</option>
          <option [value]="i.key" *ngFor="let i of complaintsProblems">{{ i.value }} </option>
        </select>
      </dd>
    </dl>
  `,
  styleUrls: ['../complaint.component.scss'],
  providers: [ComplaintService]
})
export class PropsCameraComponent implements ViewCell, OnInit {
  @Input() value: string | number;
  @Input() rowData: any;

  complaintsProblems: { key: string; value: string }[];
  constructor(
    private camerasTableService: CamerasTableService,
    private complaintService: ComplaintService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rowData.country = getCountryNameByCode(this.rowData.country);
    this.complaintService.getComplaintsProblems().then((result: any) => {
      this.complaintsProblems = result;
      this.cdr.markForCheck();
    });
  }

  getImageByCameraId(e: Event, id: string): void {
    e.preventDefault();
    const newTab = window.open('', `${id}`);
    newTab.onunload = () => this.getImageByCameraId(e, id);
    if (newTab.document.querySelector('img')) {
      const img = newTab.document.querySelector('img');
      newTab.document.body.removeChild(img);
    }
    this.camerasTableService
      .getImageFromCamera(id)
      .then(res => {
        newTab.document.body.style.backgroundColor = 'rgba(0,0,0,0.8)';
        return new Blob([res as any], { type: 'image/jpeg' });
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = loadEvent => {
          const dataUrl = (loadEvent.target as any).result;
          const img = new Image();
          img.src = dataUrl;
          img.setAttribute(
            'style',
            'width:auto;height:700px;display:block;margin:20px auto;border:5px solid white'
          );
          newTab.location.hash = `#/${id}`;
          newTab.document.body.appendChild(img);
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => err);
  }

  onProblemsSelectedChanged(event, id: string) {
    const problemKey = event.target.value === 'null' ? null : event.target.value;
    this.complaintService.setComplaintProblem(id, problemKey);
  }
}
