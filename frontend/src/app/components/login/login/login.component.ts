import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import Swal from 'sweetalert2';
import { catchError, tap } from 'rxjs';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './login.component.html',
})
export class LoginComponent {
    private auth   = inject(AuthService);
    private fb     = inject(FormBuilder);
    private router = inject(Router);

    currentYear   = new Date().getFullYear();
    showPassword  = signal(false);
    loading       = signal(false);
    errorMessage  = '';

    loginForm: FormGroup = this.fb.group({
        correo:   ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
    });

    togglePassword() { this.showPassword.update(v => !v); }

    fillDemo(correo: string) {
        this.loginForm.patchValue({ correo, password: '1234' });
        this.errorMessage = '';
    }

    onSubmit() {
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }
        this.loading.set(true);
        this.errorMessage = '';

        const { correo, password } = this.loginForm.value;

        this.auth.login(correo, password).pipe(
            tap(() => {
                this.router.navigate([this.auth.getDefaultRoute()]);
                Swal.fire({ icon: 'success', title: 'Bienvenido', text: 'Has iniciado sesión correctamente.', showConfirmButton: false, timer: 1500 });
            }),
            catchError(error => {
                this.errorMessage = error?.error?.message || error.message || 'Error al iniciar sesión';
                this.loading.set(false);
                throw error;
            }),
        ).subscribe({ complete: () => this.loading.set(false) });
    }
}
