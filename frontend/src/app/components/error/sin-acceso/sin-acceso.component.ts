import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
    selector: 'app-sin-acceso',
    imports: [],
    templateUrl: './sin-acceso.component.html',
    styles: ``
})
export class SinAccesoComponent {
    private router   = inject(Router);
    private location = inject(Location);

    volver() { this.location.back(); }
    irInicio() { this.router.navigate(['/dashboard']); }
}
