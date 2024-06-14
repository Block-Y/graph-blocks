import { BlockModel, Slot } from "@blocksuite/store";
import { Disposable, DisposableGroup } from "@blocksuite/global/utils";

export function multiDisposeSafe(disposable: Disposable): Disposable {
    let isDisposed = false

    return {
        dispose() {
            if (isDisposed)
                return

            isDisposed = true
            disposable.dispose()
        }
    }
}

export interface DisposableResults<T> {
    results: T
    disposable: Disposable
}

export function reactive() {
    
}

export function observeChildren<Child extends BlockModel = BlockModel>(block: BlockModel, observe: (child: Child) => Disposable): Disposable {
    const observeMap = new Map<Child, Disposable>()
    function startObserve(child: Child) {
        if (!observeMap.has(child))
            observeMap.set(child, observe(child))
    }

    block.children.forEach(child => startObserve(child as Child))

    return {
        dispose() {
            observeMap.forEach(disposable => disposable.dispose())
        }
    }
}

export class ObservableSet<T> extends Set<T> implements Disposable {
    readonly slots = {
        add: new Slot<T>(),
        delete: new Slot<T>(),
        changed: new Slot<{
            old: T[]
            new: T[]
        }>()
    }

    private readonly observers: Disposable[] = []

    dispose() {
        for (const disposable of this.observers)
            disposable.dispose()
    }

    observe(observe: (item: T) => Disposable | void): Disposable {
        const disposable = new DisposableGroup()

        const observers = new Map<T, Disposable | void>()
        function startObserve(item: T) {
            if (!observers.has(item))
                observers.set(item, observe(item))
        }

        disposable.add(this.slots.add.on(startObserve))
        disposable.add(this.slots.delete.on(item => {
            observers.get(item)!.dispose()
            observers.delete(item)
        }))

        this.forEach(item => startObserve(item))
        disposable.add(() => observers.forEach(observer => observer?.dispose()))

        const safeDisposable = multiDisposeSafe(disposable)

        this.observers.push(safeDisposable)

        return safeDisposable
    }

    addRevokable(value: T): Disposable {
        this.add(value)

        return {
            dispose: () => this.delete(value)
        }
    }

    addRevokablyTo(superset: ObservableSet<T>): Disposable {
        return this.observe(item => superset.addRevokable(item))
    }

    override add(value: T): this {
        if (this.has(value))
            return this
        
        const values = [...this.values()]

        super.add(value)

        this.slots.add.emit(value)
        this.slots.changed.emit({
            old: values,
            new: [...values, value]
        })

        return this
    }

    set(value: T) {
        const values = [...this.values()]
        
        if (!values.includes(value)) {
            super.clear()
            
            for (const value of values)
                this.slots.delete.emit(value)
            
            super.add(value)
            this.slots.add.emit(value)
        }
        else {
            for (const value2 of values) {
                if (value2 !== value) {
                    super.delete(value2)
                    this.slots.delete.emit(value2)
                }
            }
        }

        this.slots.changed.emit({
            old: values,
            new: [value]
        })
    }

    override clear(): void {
        const values = [...this.values()]

        super.clear()

        for (const item of this.values())
            this.slots.delete.emit(item)
        
        this.slots.changed.emit({
            old: values,
            new: []
        })
    }

    override delete(value: T): boolean {
        if (super.delete(value)) {
            const values = [...this.values()]
            this.slots.delete.emit(value)
            this.slots.changed.emit({
                old: [...values, value],
                new: values
            })
            return true
        }

        return false
    }
}