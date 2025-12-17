# Context Menu - Масштабируемая система контекстных меню

## Быстрый старт

### Простое меню с одной кнопкой

```typescript
import { ContextMenuBuilder } from '@shared/components';

const items = ContextMenuBuilder.create()
  .addButton({
    id: 'delete',
    label: 'Удалить',
    icon: Trash2,
    onClick: (id) => console.log('Deleted!')
  })
  .build();
```

### Меню с регулятором громкости

```typescript
const items = ContextMenuBuilder.create()
  .addSlider({
    id: 'volume',
    label: 'Громкость',
    icon: Volume2,
    value: 75,
    min: 0,
    max: 100,
    step: 5,
    onChange: (id, value) => setVolume(value)
  })
  .build();
```

### Сложное меню с группами

```typescript
const items = ContextMenuBuilder.create()
  // Основные действия
  .addButton({
    id: 'copy',
    label: 'Копировать',
    icon: Copy,
    onClick: () => copy()
  })
  .addButton({
    id: 'paste',
    label: 'Вставить',
    icon: Clipboard,
    onClick: () => paste()
  })
  
  // Группа с разделителем
  .addGroup((menu) => {
    menu.addButton({
      id: 'rename',
      label: 'Переименовать',
      icon: Edit,
      onClick: () => rename()
    });
  })
  
  // Опасные действия
  .addGroup((menu) => {
    menu.addButton({
      id: 'delete',
      label: 'Удалить',
      icon: Trash2,
      onClick: () => confirmDelete()
    });
  })
  .build();
```

### Условные элементы

```typescript
const isOwner = true;
const canEdit = false;

const items = ContextMenuBuilder.create()
  .addButton({
    id: 'view',
    label: 'Просмотр',
    icon: Eye,
    onClick: () => view()
  })
  
  // Показать только если можно редактировать
  .addIf(canEdit, (menu) => 
    menu.addButton({
      id: 'edit',
      label: 'Редактировать',
      icon: Edit,
      onClick: () => edit()
    })
  )
  
  // Показать только для владельца
  .addIf(isOwner, (menu) =>
    menu
      .addDivider()
      .addButton({
        id: 'delete',
        label: 'Удалить',
        icon: Trash2,
        onClick: () => deleteItem()
      })
  )
  .build();
```

## Использование в шаблоне

```html
<app-context-menu
  [isOpen]="showMenu"
  [position]="menuPosition"
  [items]="menuItems"
  (closed)="closeMenu()"
></app-context-menu>
```

## Открытие меню по правому клику

```typescript
onContextMenu(event: MouseEvent): void {
  event.preventDefault();
  
  this.menuPosition = { x: event.clientX, y: event.clientY };
  this.menuItems = this.buildMenuItems();
  this.showMenu = true;
}
```

## Типы элементов

- **button** - Кнопка с действием
- **slider** - Регулятор с диапазоном значений
- **divider** - Разделитель между группами
- **custom** - Пользовательский контент через `ng-content`

## API ContextMenuBuilder

### `addButton(config)`
Добавляет кнопку с действием.

**Параметры:**
- `id` - Уникальный идентификатор
- `label` - Текст кнопки
- `icon?` - Иконка из lucide-angular
- `disabled?` - Отключить кнопку
- `onClick?` - Callback при клике

### `addSlider(config)`
Добавляет регулятор значения.

**Параметры:**
- `id` - Уникальный идентификатор
- `label` - Название регулятора
- `icon?` - Иконка
- `value?` - Текущее значение (по умолчанию 50)
- `min?` - Минимум (по умолчанию 0)
- `max?` - Максимум (по умолчанию 100)
- `step?` - Шаг (по умолчанию 1)
- `disabled?` - Отключить регулятор
- `onChange?` - Callback при изменении

### `addDivider()`
Добавляет визуальный разделитель.

### `addGroup(builder)`
Добавляет группу элементов с автоматическим разделителем.

**Параметры:**
- `builder` - Функция для построения группы

### `addIf(condition, builder)`
Условно добавляет элементы.

**Параметры:**
- `condition` - Условие для показа
- `builder` - Функция для построения элементов

## Преимущества новой архитектуры

✅ **Fluent API** - Читаемый цепочный синтаксис  
✅ **Декларативность** - Описываете что нужно, а не как  
✅ **Типобезопасность** - TypeScript подсказки на каждом шаге  
✅ **Callbacks встроены** - Не нужно отдельно обрабатывать события  
✅ **Условная логика** - `.addIf()` для сложных сценариев  
✅ **Группировка** - `.addGroup()` с автоматическими разделителями  
✅ **Переиспользование** - Создавайте сервисы для типовых меню
















