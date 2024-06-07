import { BlockElement, BlockService, BlockSpec, BlockStdScope, BlockView, SpecStore, ViewStore } from "@blocksuite/block-std";
import { Disposable, DisposableGroup } from "@blocksuite/global/utils";
import { BlockModel, BlockSchemaType, SchemaToModel, Slot, defineBlockSchema } from "@blocksuite/store";
import { customElement } from "lit/decorators.js";
import { literal } from "lit/static-html.js"

export const MultiBlockFlavour = 'multi-block-data'
export type MultiBlockFlavour = typeof MultiBlockFlavour

export const BlockConversionFlavour = 'block-conversion'
export type BlockConversionFlavour = typeof BlockConversionFlavour

export const MultiBlockViewFlavourBase = 'multi-block-view'
export type MultiBlockViewFlavourBase = typeof MultiBlockViewFlavourBase

export type MultiBlockViewFlavour = `${MultiBlockViewFlavourBase}-${string}`

export const MultiBlockStackedViewFlavour = `${MultiBlockViewFlavourBase}-stacked`
export type MultiBlockStackedViewFlavour = typeof MultiBlockStackedViewFlavour

export const MultiBlockRootFlavour = 'multi-block-root'
export type MultiBlockRootFlavour = typeof MultiBlockRootFlavour

export type MultiBlockProps = {
    primaryBlockId: BlockModel["id"]
    blocks: BlockModel["id"][]
    conversionIds: BlockModel["id"][]
}

export type BlockConversionProps = {
    multiBlockId: BlockModel['id']
    convertedBlockId: BlockModel['id']
}

export type MultiBlockStackedViewProps = {
    path: BlockElement["path"]
    displayBlockIds: BlockModel["id"][]
}

export const MultiBlockRootSchema = defineBlockSchema({
    flavour: MultiBlockRootFlavour,
    metadata: {
        version: 1,
        role: "hub",
        children: [MultiBlockFlavour],
    },
})

export const MultiBlockSchema = defineBlockSchema({
    flavour: MultiBlockFlavour,
    props: internal => <MultiBlockProps>({
        primaryBlockId: '',
        blocks: [],
        conversionIds: [],
    }),
    metadata: {
        version: 1,
        role: 'content',
        parent: [MultiBlockRootFlavour],
        children: [MultiBlockViewFlavourBase],
    },
})

export const BlockConversionSchema = defineBlockSchema({
    flavour: BlockConversionFlavour,
    props: (internal): BlockConversionProps => ({
        multiBlockId: '',
        convertedBlockId: '',
    }),
    metadata: {
        version: 1,
        role: 'content',
        parent: [MultiBlockRootFlavour],
        children: [],
    },
})

export interface MultiBlockStackedViewSchemaType<Flavour extends MultiBlockStackedViewFlavour = MultiBlockStackedViewFlavour> extends BlockSchemaType {
    flavour: Flavour
}

export const MultiBlockStackedViewSchema = defineBlockSchema({
    flavour: MultiBlockStackedViewFlavour,
    props: (internal): MultiBlockStackedViewProps => ({
        path: [],
        displayBlockIds: [],
    }),
    metadata: {
        version: 1,
        role: 'content',
        parent: [MultiBlockFlavour],
        children: [],
    },
})

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [MultiBlockFlavour]: MultiBlockModel
            [BlockConversionFlavour]: BlockConversionModel
            [MultiBlockStackedViewFlavour]: MultiBlockStackedViewModel
            [MultiBlockRootFlavour]: MultiBlockRootModel
        }

        interface BlockServices {
            [MultiBlockFlavour]: MultiBlockService
        }
    }
}

export type MultiBlockEvent = {
    multiBlock: MultiBlockModel
}

export type MultiBlockViewEvent = MultiBlockEvent & {
    multiBlockView: MultiBlockStackedViewModel
}

export type MultiBlockBlocksEvent = MultiBlockEvent & {
    block: BlockModel
}

export type MultiBlockConversionsEvent = MultiBlockEvent & {
    conversion: BlockConversionModel
}

export interface MultiBlockSlotTypes {
    primaryChanged: MultiBlockEvent
    blockAdded: MultiBlockBlocksEvent
    blockRemoved: MultiBlockBlocksEvent
    conversionAdded: MultiBlockConversionsEvent
    conversionRemoved: MultiBlockConversionsEvent
}

export class MultiBlockModel<Primary extends BlockModel = BlockModel> extends BlockModel<MultiBlockProps> {
    primary!: Primary

    readonly slots: { [K in keyof MultiBlockSlotTypes]: Slot<MultiBlockSlotTypes[K]> } = {
        primaryChanged: new Slot(),
        blockAdded: new Slot(),
        blockRemoved: new Slot(),
        conversionAdded: new Slot(),
        conversionRemoved: new Slot(),
    }
}

export abstract class BlockConversionModel<
        PrimaryModel extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<PrimaryModel> = MultiBlockModel<PrimaryModel>,
    > extends BlockModel<BlockConversionProps> {
    multiBlock!: MultiBlockModelType

    abstract convert(std: BlockStdScope): void

    abstract sync(svc: MultiBlockService): () => void
}

export type MultiBlockStackedViewModel = SchemaToModel<typeof MultiBlockStackedViewSchema>
export type MultiBlockRootModel = SchemaToModel<typeof MultiBlockRootSchema>

export interface BlockConversionRequest<
        Primary extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<Primary> = MultiBlockModel<Primary>
    > {
    multiBlock: MultiBlockModelType
    std: BlockStdScope
}

export interface BlockConverter<
        Primary extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<Primary> = MultiBlockModel<Primary>
    > {
    convert(request: BlockConversionRequest<Primary, MultiBlockModelType>): () => void
}

export interface SimpleBlockSyncRequest<
        Primary extends BlockModel = BlockModel,
        SyncModel extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<Primary> = MultiBlockModel<Primary>,
        Conversion extends SimpleBlockConversionModel<Primary, SyncModel, MultiBlockModelType> = SimpleBlockConversionModel<Primary, SyncModel, MultiBlockModelType>,
    >
    extends BlockConversionRequest<
        Primary,
        MultiBlockModelType
    > {
    conversion: Conversion
}

export abstract class SimpleBlockConversionModel<
        Primary extends BlockModel = BlockModel,
        SyncModel extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<Primary> = MultiBlockModel<Primary>
    > extends BlockConversionModel<Primary, MultiBlockModelType> {
    syncedModel!: SyncModel

    protected abstract updateFromPrimary(primaryUpdate: unknown, std: BlockStdScope): void
    protected abstract updateToPrimary(syncedBlockUpdate: unknown, std: BlockStdScope): void

    override sync(svc: MultiBlockService): () => void {
        const disposables = [
            this.syncedModel.childrenUpdated.on(() =>
                this.updateToPrimary(null, svc.std)
            ),
            this.syncedModel.propsUpdated.on(() =>
                this.updateToPrimary(null, svc.std)
            ),
            this.multiBlock.primary.childrenUpdated.on(() =>
                this.updateFromPrimary(null, svc.std)
            ),
            this.multiBlock.primary.propsUpdated.on(() =>
                this.updateFromPrimary(null, svc.std)
            )
        ]

        return () => disposables.forEach(_ => _.dispose())
    }
}

export abstract class SimpleBlockConverter<
        Primary extends BlockModel = BlockModel,
        SyncModel extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel<Primary> = MultiBlockModel<Primary>,
        Conversion extends SimpleBlockConversionModel<Primary, SyncModel, MultiBlockModelType> = SimpleBlockConversionModel<Primary, SyncModel, MultiBlockModelType>
    >
    implements BlockConverter<Primary, MultiBlockModelType> {
    protected abstract makeConversion(request: BlockConversionRequest<Primary, MultiBlockModelType>): Conversion
    protected abstract originatesConversion(conversion: BlockConversionModel<Primary, MultiBlockModelType>): boolean

    convert(request: BlockConversionRequest<Primary, MultiBlockModelType>): () => void {
        const { multiBlock, std } = request
        const service = std.spec.getService(MultiBlockFlavour)

        const conversions = multiBlock.conversionIds.map(id => std.doc.getBlock(id)! as unknown as BlockConversionModel<Primary, MultiBlockModelType>)
        const originated = conversions.find(conversion => this.originatesConversion(conversion))

        if (originated)
            return originated.sync(service)
        else {
            const newConversion = this.makeConversion(request)

            std.doc.updateBlock<Partial<MultiBlockProps>>(multiBlock, {
                conversionIds: [...multiBlock.conversionIds, newConversion.id],
                blocks: [...multiBlock.blocks, newConversion.convertedBlockId]
            })

            return () => { }
        }
    }
}

export class MultiBlockService extends BlockService<MultiBlockModel> {
    readonly slots: MultiBlockModel["slots"] = {
        primaryChanged: new Slot(),
        blockAdded: new Slot(),
        blockRemoved: new Slot(),
        conversionAdded: new Slot(),
        conversionRemoved: new Slot(),
    }

    rootBlockId!: BlockModel['id']

    readonly converters: BlockConverter[] = []
    private readonly converterWatchCancelCallback = new Map<MultiBlockModel, (() => void)[]>()

    private readonly _multiBlockViewModels = new Map<BlockModel, Set<MultiBlockModel>>()

    private _multiBlockViewModelsFor(block: BlockModel) {
        const existing = this._multiBlockViewModels.get(block)
        if (existing)
            return existing

        return this._multiBlockViewModels.set(block, new Set()).get(block)!
    }

    override mounted(): void {
        this.blockConnected.on(({ multiBlock, block }) => {
            this._multiBlockViewModelsFor(block).add(multiBlock)
        })

        this.blockDisconnected.on(({ multiBlock, block }) => {
            this._multiBlockViewModelsFor(block).delete(multiBlock)
        })
    }

    multiBlockModelWithView<Primary extends BlockModel = BlockModel>(block: Primary) {
        const existing = [...this._multiBlockViewModelsFor(block)][0]
        if (existing)
            return existing

        const multiBlock = this.doc.getBlock(this.doc.addBlock(MultiBlockFlavour, {
            primaryBlockId: block.id,
            blocks: [block.id],
            conversionIds: [],
        }, this.rootBlockId)) as unknown as MultiBlockModel<Primary>

        this.slots.blockAdded.emit({ multiBlock, block })
        this.slots.primaryChanged.emit({ multiBlock })

        return multiBlock
    }

    setMultiBlocks(path: BlockElement["path"], multiBlocks: Record<BlockModel["id"], MultiBlockModel["id"]>, flavour: MultiBlockViewFlavour) {
        
    }
}

export const MultiBlockSpec: BlockSpec = {
    schema: MultiBlockSchema,
    service: MultiBlockService,
    view: {
        component: literal`${MultiBlockFlavour}`,
    },
}

export const MultiBlockStackedViewSpec: BlockSpec = {
    schema: MultiBlockStackedViewSchema,
    view: {
        component: literal`${MultiBlockStackedViewFlavour}`
    }
}

@customElement(MultiBlockStackedViewFlavour)
export class MultiBlockStackedView<
        TrueModel extends BlockModel = BlockModel,
        MultiBlockModelType extends MultiBlockModel = MultiBlockModel
    > extends BlockElement<TrueModel> {
    private _multiBlockModel: MultiBlockModelType | null = null
    private _multiBlockViewModel: MultiBlockStackedViewModel | null = null

    protected get multiBlockModel(): MultiBlockModelType {
        if (this._multiBlockModel)
            return this._multiBlockModel

        this._multiBlockModel = <MultiBlockModelType>this.multiBlockService.multiBlockModelWithView(this.model)

        return this._multiBlockModel
    }

    protected get multiBlockViewModel() {
        if (!this._multiBlockViewModel) {
            this._multiBlockViewModel!.path
        }
        
        return this._multiBlockViewModel!
    }

    private get multiBlockService() {
        return this.std.spec.getService(MultiBlockFlavour)
    }

    override connectedCallback() {
        super.connectedCallback()

        this.disposables.add(
            this.multiBlockViewModel.propsUpdated.on(({ key }) => {
                if (key === ('displayBlockIds' satisfies keyof MultiBlockStackedViewProps))
                    this.doc.updateBlock(this.multiBlockViewModel, { children: this.multiBlockViewModel.displayBlockIds.map(id => this.doc.getBlock(id)! as unknown as BlockModel) })
            })
        )

        const updateChildrenUpdateDisposable = () => {
            const childrenUpdateDisposable = new DisposableGroup()
            this.multiBlockViewModel.children.forEach(displayBlock => {
                childrenUpdateDisposable!.add(
                    displayBlock.childrenUpdated.on(() => this.requestUpdate())
                )

                childrenUpdateDisposable!.add(
                    displayBlock.propsUpdated.on(() => this.requestUpdate())
                )
            })
            
            return childrenUpdateDisposable
        }

        let childrenUpdateDisposable = updateChildrenUpdateDisposable()

        this.disposables.add(() => childrenUpdateDisposable.dispose())

        this.disposables.add(
            this.multiBlockViewModel.childrenUpdated.on(() => {
                childrenUpdateDisposable.dispose()
                childrenUpdateDisposable = updateChildrenUpdateDisposable()
                this.requestUpdate()
            })
        )

        const isChildSelected = () =>
            this.std.selection.value.some(selection =>
                selection.is('block') &&
                this.multiBlockViewModel.displayBlockIds.includes(selection.blockId)
            )
        
        let wasChildSelected = isChildSelected()

        this.disposables.add(
            this.host.selection.slots.changed.on(() => {
                const isChildSelectedPresent = isChildSelected()
                const update = isChildSelectedPresent || wasChildSelected
                wasChildSelected = isChildSelectedPresent
                
                if (update)
                    this.requestUpdate()
            })
        )
    }

    override render() {
        return this.renderChildren(this.multiBlockViewModel)
    }
}

export abstract class SimpleBlockElementWithMultiBlocks<
        Model extends BlockModel = BlockModel,
        Service extends BlockService = BlockService,
        WidgetName extends string = string,
    > extends BlockElement<Model, Service, WidgetName> {
    protected abstract get multiBlockViewFlavour(): `${MultiBlockViewFlavourBase}-${string}`
    
    protected abstract get multiBlocks(): Record<BlockModel["id"], MultiBlockModel["id"]>
    
    protected prepareMultiBlocks() {
        const service = this.std.spec.getService(MultiBlockFlavour)
        service.setMultiBlocks(this.path, this.multiBlocks, this.multiBlockViewFlavour)
    }
}
