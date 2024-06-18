import { Block, BlockModel, Doc, Slot } from "@blocksuite/store";
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

export function observeFlavour<Flavour extends BlockSuite.Flavour = BlockSuite.Flavour>(
        flavour: `${Flavour}${string}`,
        doc: Doc,
        observe: (block: BlockSuite.BlockModels[Flavour]) => Disposable | void
    ): Disposable {
    type Block = BlockSuite.BlockModels[Flavour]
    
    const observeMap = new Map<Block, Disposable>()
    function startObserve(block: Block) {
        if (!observeMap.has(block)) {
            const observation = observe(block)
            if (observation)
                observeMap.set(block, observation)
        }
    }

    const disposable = new DisposableGroup()

    disposable.add(() => observeMap.forEach(disposable => disposable.dispose()))
    disposable.add(doc.slots.blockUpdated.on(blockUpdate => {
        if (blockUpdate.type === "add")
            startObserve(blockUpdate.model as Block)
    }))
    doc.getBlocksByFlavour(flavour).forEach(block => startObserve(block.model as Block))

    return disposable
}

export function observeProperty<Props extends object = object, Model extends BlockModel<Props> = BlockModel<Props>, Property extends keyof Props = keyof Props>(
        block: Model,
        property: Property,
        observe: (value: Props[Property]) => Disposable | void,
        equalityFn: (prevValue: Props[Property], newValue: Props[Property]) => boolean = (a, b) => a === b
    ): Disposable {
    const disposable = new DisposableGroup()
    
    let observation: Disposable | undefined | void
    function resetObservation() {
        observation?.dispose()
        observation = observe(block[property as unknown as keyof Model] as unknown as Props[Property])
    }

    disposable.add(() => observation?.dispose())
    
    let prevValue = <Props[Property]><unknown>block[property as unknown as keyof Model]
    disposable.add(block.propsUpdated.on(({ key }) => {
        if (key === property) {
            let currentValue = <Props[Property]><unknown>block[property as unknown as keyof Model]
            if (!equalityFn(prevValue, currentValue))
                resetObservation()
        }
    }))

    resetObservation()
    
    return disposable
}

export function observeProperties(block: BlockModel, observe: (property: string) => Disposable | void): Disposable {
    const disposable = new DisposableGroup()

    const observeMap = new Map<string, Disposable>()
    function startObserve(property: string) {
        if (!observeMap.has(property)) {
            const observation = observe(property)
            if (observation)
                observeMap.set(property, observation)
        }
    }

    disposable.add(() => observeMap.forEach(disposable => disposable.dispose()))

    disposable.add(block.propsUpdated.on(({ key }) => {
        const removed = new Set<string>(observeMap.keys())
        
        for (const newKey of block.keys)
            if(!removed.delete(newKey))
                startObserve(newKey)
        
        for (const removedChild of removed) {
            observeMap.get(removedChild)?.dispose()
            observeMap.delete(removedChild)
        }
    }))

    block.keys.forEach(property => startObserve(property))

    return disposable
}

export type ImmediateOrPromiseLike<T> = T | PromiseLike<T>

export async function childBlock<Child extends BlockModel = BlockModel>(
        block: BlockModel,
        filter: (child: Child) => ImmediateOrPromiseLike<boolean>,
        initialize: () => ImmediateOrPromiseLike<Child>,
        disposable: DisposableGroup
    ) {
    let childrenObservation: Disposable

    let resolution: (child: Child) => void
    const child = new Promise<Child>((resolve, reject) => {
        resolution = resolve
        disposable.add(() => reject())
    })

    async function evaluate(child: Child) {
        if (await filter(child))
            resolution(child)
    }

    observeChildren<Child>(block, (child, disposable) => {
        evaluate(child)
        
        disposable.add(child.childrenUpdated.on(() => evaluate(child)))
        disposable.add(child.propsUpdated.on(() => evaluate(child)))
    }, disposable)

    return await child
}

export function observeChildren<Child extends BlockModel = BlockModel, ObservationResult = void>(block: BlockModel, observe: (child: Child, disposable: DisposableGroup) => Observation, disposable: DisposableGroup): ObservationMap<Child["id"], Child, ObservationResult> {
    const observationMap: ObservationMap<Child, Child, ObservationResult> = new Map()
    function startObserve(child: Child) {
        if (!observeMap.has(child.id)) {
            const observation = observe(child)
            if (observation)
                observeMap.set(child, observation)
        }
    }

    disposable.add(() => observeMap.forEach(disposable => disposable.dispose()))

    disposable.add(block.childrenUpdated.on(() => {
        const removed = new Set<Child>(observeMap.keys())
        
        for (const newChild of block.children)
            if(!removed.delete(newChild as Child))
                startObserve(newChild as Child)
        
        for (const removedChild of removed) {
            observeMap.get(removedChild)?.dispose()
            observeMap.delete(removedChild)
        }
    }))

    block.children.forEach(child => startObserve(child as Child))

    return disposable
}

type Observation<Block extends BlockModel = BlockModel, ObservationResult = void> = {
    block: Block
    disposable: Disposable
    observation: Observation
}

type ObservationArray<Block extends BlockModel = BlockModel, ObservationResult = void> = Observation<Block, ObservationResult>[]

type ObservationMap<K, Block extends BlockModel = BlockModel, ObservationResult = void> = Map<K, Observation<Block, ObservationResult>>

type ObservationLookup<K, Block extends BlockModel = BlockModel, ObservationResult = void> = Map<K, Observation<Block, ObservationResult>[]>

type FlavourObservationMap<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void> = DisposableResults<ObservationMap<K, BlockSuite.BlockModels[Flavour], ObservationResult>>
type FlavourObservationLookup<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void> = DisposableResults<ObservationLookup<K, BlockSuite.BlockModels[Flavour], ObservationResult>>

function flavouredObservationMap<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void>(
        flavour: `${Flavour}${string}`,
        modelToKey: (model: BlockSuite.BlockModels[Flavour]) => K,
        observer: (model: BlockSuite.BlockModels[Flavour], disposable: DisposableGroup) => ObservationResult,
        doc: Doc
    ) {
    return new FlavourObservable(doc).observeMap(flavour, modelToKey, observer)
}

function flavouredObservationLookup<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void>(
    flavour: `${Flavour}${string}`,
    modelToKey: (model: BlockSuite.BlockModels[Flavour]) => K,
    observer: (model: BlockSuite.BlockModels[Flavour], disposable: DisposableGroup) => ObservationResult,
    doc: Doc
) {
    return new FlavourObservable(doc).observeLookup(flavour, modelToKey, observer)
}

class FlavourObservable {
    readonly disposable = new DisposableGroup()

    constructor(public readonly doc: Doc) { }

    observeMap<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void>(
            flavour: `${Flavour}${string}`,
            modelToKey: (model: BlockSuite.BlockModels[Flavour]) => K,
            observer: (model: BlockSuite.BlockModels[Flavour], disposable: DisposableGroup) => ObservationResult
        ) {
        type Block = BlockSuite.BlockModels[Flavour]

        const map: ObservationMap<K, Block, ObservationResult> = new Map()

        const disposable = observeFlavour<Flavour>(flavour, this.doc, block => {
            const key = modelToKey(block)
            if (map.has(key))
                throw new Error("duplicate key")

            const disposable = new DisposableGroup()

            disposable.add(() => map.delete(key))
            
            const observation = observer(block, disposable)

            map.set(key, { block, disposable, observation })

            return disposable
        })

        const safeDisposable = multiDisposeSafe(disposable)

        this.disposable.add(safeDisposable)

        return <FlavourObservationMap<K, Flavour, ObservationResult>>{
            disposable: safeDisposable,
            results: map
        }
    }

    observeLookup<K, Flavour extends BlockSuite.Flavour = BlockSuite.Flavour, ObservationResult = void>(
            flavour: `${Flavour}${string}`,
            modelToKey: (model: BlockSuite.BlockModels[Flavour]) => K,
            observer: (model: BlockSuite.BlockModels[Flavour], disposable: DisposableGroup) => ObservationResult
        ) {
        type Block = BlockSuite.BlockModels[Flavour]

        const lookup: ObservationLookup<K, Block, ObservationResult> = new Map()

        const disposable = observeFlavour<Flavour>(flavour, this.doc, block => {
            const key = modelToKey(block)

            const array = lookup.get(key) ?? lookup.set(key, []).get(key)!

            const disposable = new DisposableGroup()
            
            const observation = observer(block, disposable)

            const entry = { block, disposable, observation }
            array.push(entry)

            disposable.add(() => {
                const index = array.findIndex(entry1 => entry1 === entry)
                array.splice(index, 1)
                if (array.length === 0)
                    lookup.delete(key)
            })

            return disposable
        })

        const safeDisposable = multiDisposeSafe(disposable)

        this.disposable.add(safeDisposable)

        return <FlavourObservationLookup<K, Flavour, ObservationResult>>{
            disposable: safeDisposable,
            results: lookup
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