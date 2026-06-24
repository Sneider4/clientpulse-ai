import { Component, signal } from '@angular/core';
import { AdminUsuariosComponent } from '../admin-usuarios/admin-usuarios.component';
import { AdminRolesComponent } from '../admin-roles/admin-roles.component';
import { AdminModulosComponent } from '../admin-modulos/admin-modulos.component';

type Tab = 'usuarios' | 'roles' | 'modulos';

@Component({
    selector: 'app-admin-panel',
    imports: [AdminUsuariosComponent, AdminRolesComponent, AdminModulosComponent],
    templateUrl: './admin-panel.component.html',
    styles: ``
})
export class AdminPanelComponent {
    tab = signal<Tab>('usuarios');
    setTab(t: Tab) { this.tab.set(t); }
}
