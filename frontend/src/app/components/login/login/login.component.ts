import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import Swal from 'sweetalert2';
import { catchError, Subscription, tap } from 'rxjs';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './login.component.html',
})
export class LoginComponent {

    private subscriptions: Subscription = new Subscription();
    private authService = inject(AuthService);


    currentYear = new Date().getFullYear();

    private fb = inject(FormBuilder);
    private auth = inject(AuthService);
    private router = inject(Router);

    loginForm: FormGroup = this.fb.group({
        correo: ['sneider@gmail.com', [Validators.required]],
        password: ['1234', [Validators.required]],
    });

    errorMessage = '';

    onSubmit() {
        if (this.loginForm.invalid) {
            this.errorMessage = 'Debe ingresar correo y contraseña.';
            return;
        }

        const { correo, password } = this.loginForm.value;

        const usuario = this.authService.login(correo, password).pipe(
            tap((usuarioLogueado) => {
                console.log('Usuario logueado:', usuarioLogueado);
                this.router.navigate(['/dashboard']);
                Swal.fire({
                    icon: "success",
                    title: "Bienvenido",
                    text: "Has iniciado sesión correctamente.",
                    showConfirmButton: false,
                    timer: 1500
                });
            }),
            catchError((error) => {
                this.errorMessage = 'Error: ' + (error?.error?.message || error.message || 'Desconocido');
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(usuario);
    }
}
