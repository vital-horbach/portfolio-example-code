import { Component, Input } from '@angular/core';
import { NbWindowService } from '@nebular/theme';
import { ImageModalComponent } from '../image-modal/image-modal.component';

@Component({
  selector: 'ngx-canvas-element',
  styleUrls: ['./canvas-element.component.scss'],
  template: `
    <div class="canvas-component">
      <ngx-canvas-parking-image
        (click)="openWindow()"
        class="pointer"
        [rowData]="rowData"
        [value]="value"
      ></ngx-canvas-parking-image>
      <a class="btn btn-primary btn-xs mr-1" target="_blank" [href]="rowData.snapshotUrl">
        Download Image
      </a>
      <a class="btn btn-primary btn-xs" (click)="downloadText()">
        Download Text
      </a>
    </div>
  `
})
export class CanvasElementComponent {
  @Input() value: string | number;
  @Input() rowData: any;

  constructor(private windowService: NbWindowService) {}

  openWindow() {
    this.windowService.open(ImageModalComponent, {
      title: 'Camera image',
      context: {
        value: this.value,
        rowData: this.rowData
      }
    });
  }

  downloadText() {
    const image = new Image();
    image.src = this.rowData.snapshotUrl;
    const height = image.naturalHeight;
    const width = image.naturalWidth;

    const text = this.rowData.foundCarsJSON
      .map(e => e.bbox)
      .reduce((m, el) => {
        return `${m}0 ${el[0] / width} ${el[1] / height} ${el[2] / width} ${el[3] / height}\n`;
      }, '');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute(
      'download',
      this.rowData.snapshotUrl
        .split('/')
        .pop()
        .replace('jpg', 'txt')
    );

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }
}
