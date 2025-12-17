import { Routes } from '@angular/router';

export const callRoutes: Routes = [
  {
    path: ':roomId',
    loadComponent: () => import('./call-room/call-room.component').then((m) => m.CallRoomComponent),
    data: {
      title: 'Комната',
      description: 'Звонок, чат и демонстрация экрана в комнате'
    },
    children: [
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/settings-container/settings-container.component').then(
            (m) => m.SettingsContainerComponent
          ),
      },
    ],
  },
];
