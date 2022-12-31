import {CSS} from '../types/css';

type HTMLElementTag = keyof HTMLElementTagNameMap;
type ResolvedHTMLElement<T extends HTMLElementTag> = HTMLElementTagNameMap[T];

export function createElement<T extends HTMLElementTag>(
  tag: T,
  classList?: string | string[],
  options?: Partial<ResolvedHTMLElement<T>>,
  children?: HTMLElement[]
): ResolvedHTMLElement<T> {
  const element = document.createElement(tag);

  if (typeof classList === 'string') {
    element.classList.add(classList);
  } else if (Array.isArray(classList)) {
    element.classList.add(...classList);
  }

  if (options) {
    Object.assign(element, options);
  }

  if (children) {
    element.append(...children);
  }

  return element;
}

export function createDiv(
  children: HTMLElement[],
  className?: string
): HTMLDivElement {
  const divElement = createElement('div', className);
  divElement.append(...children);
  return divElement;
}

export function createInputAsLabel(
  title: string,
  className?: string
): HTMLInputElement {
  const classList: string[] = [CSS.inputAsLabel];
  if (className) {
    classList.push(className);
  }
  return createElement('input', classList, {
    type: 'text',
    value: title,
    readOnly: true,
  });
}
