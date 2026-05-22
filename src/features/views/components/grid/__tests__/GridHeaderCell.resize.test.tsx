import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { GridHeaderCell } from "../GridHeaderCell";

/**
 * jsdom (used by vitest) does not implement PointerEvent.
 * We polyfill it here by subclassing MouseEvent and injecting pointerId.
 * This lets us dispatch real pointer events with clientX set correctly.
 */
beforeAll(() => {
  if (typeof (global as Record<string, unknown>).PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (global as Record<string, unknown>).PointerEvent = PointerEventPolyfill;
    // jsdom elements don't implement pointer capture; stub them so the component
    // won't throw when it calls setPointerCapture / releasePointerCapture.
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

/**
 * Helper: dispatch a native PointerEvent so that clientX is actually set.
 * @testing-library's fireEvent.pointerDown() doesn't forward clientX in jsdom.
 */
function ptrDown(el: HTMLElement, clientX: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.dispatchEvent(new (global as any).PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX, pointerId: 1 }));
}
function ptrMove(el: HTMLElement, clientX: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.dispatchEvent(new (global as any).PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX, pointerId: 1 }));
}
function ptrUp(el: HTMLElement, clientX: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.dispatchEvent(new (global as any).PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX, pointerId: 1 }));
}

describe("GridHeaderCell — resize handle", () => {
  it("renders the handle div when onWidthChange is provided", () => {
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
        width={120}
        onWidthChange={() => {}}
      />
    );
    const handle = container.querySelector('[aria-hidden]');
    expect(handle).not.toBeNull();
  });

  it("does not render the handle div when onWidthChange is omitted", () => {
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
      />
    );
    const handle = container.querySelector('[aria-hidden]');
    expect(handle).toBeNull();
  });

  it("fires onWidthChange with correct width on pointerdown → pointermove → pointerup", () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
        width={120}
        onWidthChange={onWidthChange}
      />
    );

    const handle = container.querySelector('[aria-hidden]') as HTMLElement;
    expect(handle).not.toBeNull();

    // Start drag at x=200, width=120; move to x=250 → delta=50 → width=170
    ptrDown(handle, 200);
    ptrMove(handle, 250);
    ptrUp(handle, 250);

    expect(onWidthChange).toHaveBeenCalledWith(170);
  });

  it("clamps width to minimum 60 when dragging far left", () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
        width={120}
        onWidthChange={onWidthChange}
      />
    );

    const handle = container.querySelector('[aria-hidden]') as HTMLElement;

    // Start at x=200, move far left to x=50 → delta=-150 → 120-150=-30, clamped to 60
    ptrDown(handle, 200);
    ptrMove(handle, 50);
    ptrUp(handle, 50);

    expect(onWidthChange).toHaveBeenCalledWith(60);
  });

  it("clamps width to maximum 600 when dragging far right", () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
        width={120}
        onWidthChange={onWidthChange}
      />
    );

    const handle = container.querySelector('[aria-hidden]') as HTMLElement;

    // Start at x=200, move far right to x=1000 → delta=800 → 120+800=920, clamped to 600
    ptrDown(handle, 200);
    ptrMove(handle, 1000);
    ptrUp(handle, 1000);

    expect(onWidthChange).toHaveBeenCalledWith(600);
  });

  it("does not call onWidthChange if pointermove never fired (no drag)", () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <GridHeaderCell
        label="Name"
        sortable={false}
        sortDir={null}
        onSortChange={() => {}}
        width={120}
        onWidthChange={onWidthChange}
      />
    );

    const handle = container.querySelector('[aria-hidden]') as HTMLElement;

    // pointerdown and pointerup at the exact same position (delta = 0)
    ptrDown(handle, 200);
    ptrUp(handle, 200);

    expect(onWidthChange).not.toHaveBeenCalled();
  });
});
