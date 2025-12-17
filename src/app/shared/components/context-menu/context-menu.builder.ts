import { ContextMenuItem } from './context-menu.component';

/**
 * Fluent Builder для создания элементов контекстного меню
 */
export class ContextMenuBuilder {
  private items: ContextMenuItem[] = [];

  /**
   * Добавить кнопку
   */
  addButton(config: {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    onClick?: (id: string) => void;
  }): this {
    this.items.push({
      id: config.id,
      label: config.label,
      icon: config.icon,
      type: 'button',
      disabled: config.disabled ?? false,
      onClick: config.onClick,
    });
    return this;
  }

  /**
   * Добавить слайдер
   */
  addSlider(config: {
    id: string;
    label: string;
    icon?: any;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    onChange?: (id: string, value: number) => void;
  }): this {
    this.items.push({
      id: config.id,
      label: config.label,
      icon: config.icon,
      type: 'slider',
      value: config.value ?? 50,
      min: config.min ?? 0,
      max: config.max ?? 100,
      step: config.step ?? 1,
      disabled: config.disabled ?? false,
      onChange: config.onChange,
    });
    return this;
  }

  /**
   * Добавить разделитель
   */
  addDivider(): this {
    this.items.push({
      id: `divider-${Date.now()}-${Math.random()}`,
      label: '',
      type: 'divider',
    });
    return this;
  }

  /**
   * Добавить элемент с пользовательским контентом
   */
  addCustom(config: {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    onClick?: (id: string) => void;
  }): this {
    this.items.push({
      id: config.id,
      label: config.label,
      icon: config.icon,
      type: 'button',
      customContent: true,
      disabled: config.disabled ?? false,
      onClick: config.onClick,
    });
    return this;
  }

  /**
   * Добавить группу элементов (с разделителями)
   */
  addGroup(builder: (group: ContextMenuBuilder) => void): this {
    if (this.items.length > 0) {
      this.addDivider();
    }
    builder(this);
    return this;
  }

  /**
   * Условное добавление элемента
   */
  addIf(
    condition: boolean,
    builder: (menu: ContextMenuBuilder) => ContextMenuBuilder
  ): this {
    if (condition) {
      builder(this);
    }
    return this;
  }

  /**
   * Получить готовый массив элементов
   */
  build(): ContextMenuItem[] {
    return this.items;
  }

  /**
   * Создать новый builder
   */
  static create(): ContextMenuBuilder {
    return new ContextMenuBuilder();
  }
}
















