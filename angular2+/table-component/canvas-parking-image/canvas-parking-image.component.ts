import { AfterViewInit, Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ColorCalculationService } from '../../../@core/services/colorCalculation.service';

@Component({
  selector: 'ngx-canvas-parking-image',
  template: `
    <canvas class="canvas-parking-image" width="1400px" id="canvas"></canvas>
  `,
  styleUrls: ['./canvas-parking-image.component.scss']
})
export class CanvasParkingImageComponent implements ViewCell, AfterViewInit {
  constructor(private colorCalculationService: ColorCalculationService) {}

  @Input() value: string | number; // This hold the cell value
  @Input() rowData: any; // This holds the entire row object
  image: any;

  ngAfterViewInit(): void {
    const canvas = <HTMLCanvasElement>document.getElementById(`canvas`);
    canvas.id = `canvas-${this.value}`;
    const ctx = canvas.getContext('2d');
    this.image = new Image();
    this.image.onload = () => {
      canvas.height = (canvas.width * this.image.naturalHeight) / this.image.naturalWidth;
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      ctx.lineWidth = canvas.height * 0.005;

      this.rowData.foundCarsJSON.forEach(car => {
        ctx.strokeStyle = this.colorCalculationService.getColor(car.probability);
        // TODO - temp image scaling
        let width = this.image.naturalWidth;
        let height = this.image.naturalHeight;
        if (car.bbox[0] <= 1) {
          width = 1;
          height = 1;
        }
        const box = [
          (car.bbox[0] / width) * canvas.width,
          (car.bbox[1] / height) * canvas.height,
          (car.bbox[2] / width) * canvas.width,
          (car.bbox[3] / height) * canvas.height
        ];
        ctx.strokeRect(box[0] - box[2] / 2, box[1] - box[3] / 2, box[2], box[3]);
      });
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#00ff00';
      if (this.rowData.carsFindZone) {
        this.rowData.carsFindZone.zone.forEach(zone => {
          ctx.beginPath();
          ctx.moveTo(zone[0][0] * canvas.width, canvas.height - zone[0][1] * canvas.height);
          for (let i = 1; i < zone.length; i++) {
            ctx.lineTo(zone[i][0] * canvas.width, canvas.height - zone[i][1] * canvas.height);
          }
          ctx.lineTo(zone[0][0] * canvas.width, canvas.height - zone[0][1] * canvas.height);
          ctx.stroke();
        });
      }
    };
    this.image.src = this.rowData.snapshotUrl;
  }
}
