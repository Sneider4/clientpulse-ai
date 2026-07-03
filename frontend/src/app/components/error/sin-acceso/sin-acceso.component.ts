import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
    selector: 'app-sin-acceso',
    imports: [],
    templateUrl: './sin-acceso.component.html',
    styles: ``
})
export class SinAccesoComponent {
    private router   = inject(Router);
    private location = inject(Location);
    private auth     = inject(AuthService);

    volver() { this.location.back(); }
    irInicio() { this.router.navigate([this.auth.getDefaultRoute()]); }
}
