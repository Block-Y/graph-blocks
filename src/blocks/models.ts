import { BlockElement, BlockService, SpecStore } from "@blocksuite/block-std"
import { BlockModel, Doc, SchemaToModel, defineBlockSchema } from "@blocksuite/store"
import { html, nothing } from "lit"
import { customElement } from "lit/decorators.js"
import { DisposableResults, ObservableSet, multiDisposeSafe, observeChildren, observeFlavour, observeProperties, observeProperty } from "../utils.js"
import { DisposableGroup, Disposable } from "@blocksuite/global/utils"
import { styleMap } from "lit/directives/style-map.js"

type BlockID = BlockModel["id"]
const BlockID_none: BlockID = ""

export const ViewRequestFlavour = "viewrequest"
export interface ViewRequestProps {
    views: BlockID[]
    allowedViews: BlockID[]
    selectedView: BlockID
}

export const ViewRequestSchema = defineBlockSchema({
    flavour: ViewRequestFlavour,
    props: (): ViewRequestProps => ({
        views: [BlockID_none],
        allowedViews: [BlockID_none],
        selectedView: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    },
})

export type ViewRequestModel = SchemaToModel<typeof ViewRequestSchema>

export interface ViewGenerator {
    view(request: ViewRequestModel, spec: SpecStore): Disposable | void
}

function rootBlock<Flavour extends BlockSuite.Flavour = BlockSuite.Flavour>(flavour: Flavour, doc: Doc): BlockSuite.BlockModels[Flavour] {
    return (doc.getBlocksByFlavour(flavour).at(0) ?? doc.getBlock(doc.addBlock(flavour))!)!.model as BlockSuite.BlockModels[Flavour]
}

export const RootViewRequestFlavour = `${ViewRequestFlavour}_root`
export const RootViewRequestSchema = defineBlockSchema({
    flavour: RootViewRequestFlavour,
    metadata: {
        role: "hub",
        version: 1,
    }
})

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [ViewRequestFlavour]: ViewRequestModel
            [RootViewRequestFlavour]: BlockModel
        }
    }
}

export class ViewRequestService extends BlockService<ViewRequestModel> {
    private _root!: BlockModel
    private _observable!: FlavourObservable
    private _viewGeneration!: ObservationMap<ViewRequestModel["id"], ViewRequestModel>

    readonly viewGenerators = new ObservableSet<ViewGenerator>()
    
    get root() {
        return this._root
    }

    get observable() {
        return this._observable
    }
    
    override mounted(): void {
        this._root = rootBlock(RootViewRequestFlavour, this.doc)
        this._observable = new FlavourObservable(this.doc)

        this.disposables.add(this._observable.disposable)

        this._viewGeneration = this._observable.observeMap<BlockID, typeof ViewRequestFlavour>(
            `${ViewRequestFlavour}-*`,
            viewRequest => viewRequest.id,
            viewRequest => this.viewGenerators.observe(viewGenerator => viewGenerator.view(viewRequest, this.std.spec))
        ).results
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [ViewRequestFlavour]: ViewRequestService
        }
    }
}

export const BlockViewRequestFlavour = `${ViewRequestFlavour}-block`
export interface BlockViewRequestProps extends ViewRequestProps {
    blockId: BlockID
}

export const BlockViewRequestSchema = defineBlockSchema({
    flavour: BlockViewRequestFlavour,
    props: (): BlockViewRequestProps => ({
        views: [BlockID_none],
        allowedViews: [BlockID_none],
        selectedView: BlockID_none,
        blockId: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type BlockViewRequestModel = SchemaToModel<typeof BlockViewRequestSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [BlockViewRequestFlavour]: BlockViewRequestModel
        }
    }
}

export const RelViewRequestFlavour = `${ViewRequestFlavour}-rel`
export interface RelViewRequestProps extends ViewRequestProps {
    relation: string
    from: BlockID
    to: BlockID
}

export const RelViewRequestSchema = defineBlockSchema({
    flavour: RelViewRequestFlavour,
    props: (): RelViewRequestProps => ({
        views: [BlockID_none],
        allowedViews: [BlockID_none],
        selectedView: BlockID_none,

        relation: "",
        from: BlockID_none,
        to: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type RelViewRequestModel = SchemaToModel<typeof RelViewRequestSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [RelViewRequestFlavour]: RelViewRequestModel
        }
    }
}

export class RelViewRequestService extends BlockService<RelViewRequestModel> {
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [RelViewRequestFlavour]: RelViewRequestService
        }
    }
}

export const PlaceViewRequestFlavour = `${ViewRequestFlavour}-place`
export interface PlaceViewRequestProps extends ViewRequestProps {
    viewRequestId: BlockID
}

export const PlaceViewRequestSchema = defineBlockSchema({
    flavour: PlaceViewRequestFlavour,
    props: (): PlaceViewRequestProps => ({
        views: [BlockID_none],
        allowedViews: [BlockID_none],
        selectedView: BlockID_none,
        
        viewRequestId: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type PlaceViewRequestModel = SchemaToModel<typeof PlaceViewRequestSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [PlaceViewRequestFlavour]: PlaceViewRequestModel
        }
    }
}

export class PlaceViewRequestService extends BlockService<PlaceViewRequestModel> {
    override mounted(): void {
        const observation = flavouredObservationLookup<PlaceViewModel["id"], typeof PlaceViewRequestFlavour>(
            PlaceViewRequestFlavour,
            placeViewRequest => placeViewRequest.id,
            placeViewRequest => {
                const disposable = new DisposableGroup()

                observeProperty<PlaceViewRequestProps, PlaceViewRequestModel, "views">(placeViewRequest, "views", viewIds => {
                    const views = viewIds.map(id => this.doc.getBlock(id)!.model as PlaceViewModel)
                    const alreadySelectedView = views.find(view => view.isSelected)
                    if (alreadySelectedView) {
                        this.doc.updateBlock<Partial<PlaceViewRequestProps>>(placeViewRequest, {
                            selectedView: alreadySelectedView.id
                        })
                    }
                    else {
                        const closestPlaceView = views.filter()
                    }
                })

                return disposable
            },
            this.doc
        )

        this.disposables.add(observation.disposable)
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [PlaceViewRequestFlavour]: PlaceViewRequestService
        }
    }
}

export const ViewFlavour = "view"
export interface ViewProps {
    requestIds: BlockID[]
}

export const ViewSchema = defineBlockSchema({
    flavour: ViewFlavour,
    props: (): ViewProps => ({
        requestIds: [BlockID_none],
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type ViewModel = SchemaToModel<typeof ViewSchema>

export const PlaceViewFlavour = `${ViewFlavour}-place`
export interface PlaceViewProps extends ViewProps {
    selectingPlaceViewRequestIdIndex: number,
}

export const PlaceViewSchema = defineBlockSchema({
    flavour: PlaceViewFlavour,
    props: (): PlaceViewProps => ({
        requestIds: [BlockID_none],

        selectingPlaceViewRequestIdIndex: -1,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type PlaceViewModel = SchemaToModel<typeof PlaceViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [PlaceViewFlavour]: PlaceViewModel
        }
    }
}

@customElement(PlaceViewFlavour)
export class PlaceViewElement extends BlockElement<PlaceViewModel> {
    override renderBlock(): unknown {
        const request = this.doc.getBlock(this.model.requestIds[0]!)!.model as PlaceViewRequestModel
        if (request.selectedView === BlockID_none)
            return nothing

        

        const selectedView = this.doc.getBlock(request.viewRequestId)!.model
        return this.renderChildren({ children: [selectedView] } as BlockModel)
    }
}

export const IndividualViewRequestPlaceViewFlavour = `${ViewRequestFlavour}-location`

export interface IndividualViewRequestPlaceViewProps extends ViewProps {
    viewRequestId: ViewRequestModel["id"]
}

export const IndividualViewRequestPlaceViewSchema = defineBlockSchema({
    flavour: IndividualViewRequestPlaceViewFlavour,
    props: (): IndividualViewRequestPlaceViewProps => ({
        requestIds: [BlockID_none],

        viewRequestId: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type IndividualViewRequestPlaceViewModel = SchemaToModel<typeof IndividualViewRequestPlaceViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [IndividualViewRequestPlaceViewFlavour]: IndividualViewRequestPlaceViewModel
        }
    }
}

export class IndividualViewRequestPlaceViewViewGenerator implements ViewGenerator {
    view(request: ViewRequestModel, spec: SpecStore): void | Disposable {
        const placeViewRequest = request as unknown as PlaceViewRequestModel
        if (placeViewRequest.flavour !== PlaceViewRequestFlavour)
            return

        const viewRequestId = placeViewRequest.viewRequestId

        const service = spec.getService(IndividualViewRequestPlaceViewFlavour).lookup
    }
}

export class IndividualViewRequestPlaceViewService extends BlockService<IndividualViewRequestPlaceViewModel> {
    private _lookup!: ObservationLookup<ViewRequestModel["id"], IndividualViewRequestPlaceViewModel>
    
    get lookup() {
        return this._lookup
    }

    override mounted(): void {
        const observation = flavouredObservationLookup<ViewRequestModel["id"], typeof IndividualViewRequestPlaceViewFlavour>(
            IndividualViewRequestPlaceViewFlavour,
            individualViewRequestPlaceView => individualViewRequestPlaceView.viewRequestId,
            individualViewRequestPlaceView => {
                const disposable = new DisposableGroup()
                const viewRequest = this.doc.getBlock(individualViewRequestPlaceView.viewRequestId)!.model as ViewRequestModel
                
                disposable.add(viewRequest.deleted.on(() => this.doc.deleteBlock(individualViewRequestPlaceView, { deleteChildren: true })))

                return disposable
            },
            this.doc
        )

        this.disposables.add(observation.disposable)
        this._lookup = observation.results
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [IndividualViewRequestPlaceViewFlavour]: IndividualViewRequestPlaceViewService
        }
    }
}

export const BlockViewFlavour = `${ViewFlavour}-block`

export interface BlockViewProps extends ViewProps {
    blockId: BlockID
}

export type BlockViewModel = BlockModel<BlockViewProps>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [BlockViewFlavour]: BlockViewModel
        }
    }
}

export const ModelBlockViewFlavour = `${BlockViewFlavour}-model`
export interface ModelBlockViewProps extends ViewProps {
}

export const ModelBlockViewSchema = defineBlockSchema({
    flavour: ModelBlockViewFlavour,
    props: (): ModelBlockViewProps => ({
        requestIds: [BlockID_none],
        
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})


export type ModelBlockViewModel = SchemaToModel<typeof ModelBlockViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [ModelBlockViewFlavour]: ModelBlockViewModel
        }
    }
}

export class ModelBlockViewService extends BlockService<ModelBlockViewModel> {
    private readonly index = new Map<BlockID, ModelBlockViewModel>()

    override mounted(): void {
        
    }


}

export class ModelBlockViewGenerator implements ViewGenerator {
    view(request: ViewRequestModel, spec: SpecStore): Disposable | void {
        const request_typed = request as unknown as BlockViewRequestModel
        if (request_typed.flavour !== BlockViewRequestFlavour)
            return

        
    }
}

export const CanvasBlockViewFlavour = `${BlockViewFlavour}-canvas`
export const CanvasPositionedFlavour = "canvas-positioned"

export interface CanvasBlockViewProps extends ViewProps {
}

export interface CanvasPositionedProps {
    requestId: ViewRequestModel["id"]
    x: number
    y: number
    w: number
    h: number
}

export const CanvasBlockViewSchema = defineBlockSchema({
    flavour: CanvasBlockViewFlavour,
    props: (): CanvasBlockViewProps => ({
        requestIds: [BlockID_none],
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export const CanvasPositionedSchema = defineBlockSchema({
    flavour: CanvasPositionedFlavour,
    props: (): CanvasPositionedProps => ({
        requestId: BlockID_none,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type CanvasBlockViewModel = SchemaToModel<typeof CanvasBlockViewSchema>

export type CanvasPositionedModel = SchemaToModel<typeof CanvasPositionedSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [CanvasBlockViewFlavour]: CanvasBlockViewModel
            [CanvasPositionedFlavour]: CanvasPositionedModel
        }
    }
}

export class CanvasPositionedService extends BlockService<CanvasPositionedModel> {
}

export class CanvasBlockViewService extends BlockService<CanvasBlockViewModel> {
    private _canvasBlockViewObservation!: FlavourObservationMap<BlockModel["id"], typeof CanvasBlockViewFlavour>

    get canvasBlockViewObservation() {
        return this._canvasBlockViewObservation
    }

    override mounted(): void {
        this._canvasBlockViewObservation = flavouredObservationMap<BlockModel["id"], typeof CanvasBlockViewFlavour>(
            CanvasBlockViewFlavour,
            canvasBlockView => (this.doc.getBlock(canvasBlockView.requestIds[0]!)!.model as BlockViewRequestModel).blockId,
            canvasBlockView => {
                const block = this.doc.getBlock(canvasBlockView.requestIds[0]!)!.model

                const disposable = new DisposableGroup()

                disposable.add(observeChildren(block, block_child => {
                    let canvasPositionedBlock = (<CanvasPositionedModel[]>canvasBlockView.children).find(canvasPositionedBlock =>
                        canvasPositionedBlock.children.some(blockViewRequest =>
                            blockViewRequest.flavour === BlockViewRequestFlavour &&
                            (blockViewRequest as BlockViewRequestModel).blockId === block_child.id
                        )
                    )

                    let blockViewRequest = <BlockViewRequestModel>canvasPositionedBlock?.children.find(blockViewRequest =>
                        blockViewRequest.flavour === BlockViewRequestFlavour &&
                        (blockViewRequest as BlockViewRequestModel).blockId === block_child.id
                    )

                    let blockPlaceViewRequest = canvasPositionedBlock?.children.find(blockPlaceViewRequest =>
                        blockPlaceViewRequest.flavour === PlaceViewRequestFlavour &&
                        (blockPlaceViewRequest as PlaceViewRequestModel).viewRequestId === blockViewRequest?.id
                    )

                    if (!canvasPositionedBlock) {
                        canvasPositionedBlock = this.doc.getBlock(this.doc.addBlock(CanvasPositionedFlavour, {
                            x: 0, y: 0, w: 100, h: 75
                        }, canvasBlockView))!.model as CanvasPositionedModel

                        blockViewRequest = this.doc.getBlock(this.doc.addBlock(BlockViewRequestFlavour, {
                            blockId: block_child.id,
                            allowedViews: [],
                            selectedView: BlockID_none,
                            views: [],
                        }, canvasPositionedBlock))!.model as BlockViewRequestModel
                    }

                    return {
                        dispose: () => {

                        }
                    }
                }))

                disposable.add(observeProperties(block, property => {

                }))

                return disposable
            },
            this.doc
        )
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [CanvasBlockViewFlavour]: CanvasBlockViewService
            [CanvasPositionedFlavour]: CanvasPositionedService
        }
    }
}

export class CanvasBlockViewGenerator implements ViewGenerator {
    view(request: ViewRequestModel, spec: SpecStore): void | Disposable {
        const request_typed = <BlockViewRequestModel><unknown>request
        if (!(('blockId' satisfies keyof typeof request_typed) in request_typed))
            return

        const blockModel = request.doc.getBlock(request_typed.blockId)!.model
        const service = 
        
        observeChildren(blockModel, child => {
            
        })
    }
}

@customElement(CanvasBlockViewFlavour)
export class CanvasBlockViewElement extends BlockElement<CanvasBlockViewModel> {
    override renderBlock(): unknown {
        return this.renderChildren(this.model)
    }
}

@customElement(CanvasPositionedFlavour)
export class CanvasPositionedElement extends BlockElement<CanvasPositionedModel> {
    override renderBlock(): unknown {
        const { x, y, w, h } = this.model

        const style = styleMap({
            'position': 'relative',
            'left': `${x}px`,
            'top': `${y}px`,
            'width': `${w}px`,
            'height': `${h}px`,
        })

        return html`<div style=${style}>
            ${this.renderChildren(this.model)}
        </div>`
    }
}

export const PlainBlockViewFlavour = `${BlockViewFlavour}-plain`

export interface PlainBlockViewProps extends BlockViewProps {
}

export const PlainBlockViewSchema = defineBlockSchema({
    flavour: PlainBlockViewFlavour,
    props: (): PlainBlockViewProps => ({
        requestIds: [BlockID_none],

        blockId: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type PlainBlockViewModel = SchemaToModel<typeof PlainBlockViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [PlainBlockViewFlavour]: PlainBlockViewModel
        }
    }
}

export class PlainBlockViewService extends BlockService<PlainBlockViewModel> {
    private _lookup!: ObservationLookup<BlockID, PlainBlockViewModel>

    get lookup() {
        return this._lookup
    }

    override mounted(): void {
        const observation = flavouredObservationLookup<BlockID, typeof PlainBlockViewFlavour>(
            `${PlainBlockViewFlavour}-*`,
            plainBlockView => plainBlockView.blockId,
            plainBlockView => {
                const block = this.doc.getBlock(plainBlockView.blockId)!.model

                const disposable = new DisposableGroup()

                disposable.add(observeChildren(block, child => {
                    let viewRequest = (<BlockViewRequestModel[]>plainBlockView.children).find(viewRequest =>
                        viewRequest.flavour === BlockViewRequestFlavour &&
                        viewRequest.blockId === child.id
                    )

                    if (!viewRequest) {
                        viewRequest = <BlockViewRequestModel>this.doc.getBlock(this.doc.addBlock(
                            BlockViewRequestFlavour,
                            {
                                blockId: child.id,
                            },
                            plainBlockView
                        ))!.model
                    }

                    let placeViewRequest = (<PlaceViewRequestModel[]>plainBlockView.children).find(placeViewRequest =>
                        placeViewRequest.flavour === PlaceViewRequestFlavour &&
                        placeViewRequest.viewRequestId === viewRequest?.id
                    )

                    if (!placeViewRequest) {
                        placeViewRequest = <PlaceViewRequestModel>this.doc.getBlock(this.doc.addBlock(
                            PlaceViewRequestFlavour,
                            {
                                viewRequestId: viewRequest.id
                            },
                            plainBlockView
                        ))!.model
                    }

                    let placeView = (<PlaceViewModel[]>plainBlockView.children).find(placeView =>
                        placeView.flavour === PlaceViewFlavour &&
                        placeView.requestIds.includes(placeViewRequest!.id)
                    )

                    if (!placeView) {
                        placeView = <PlaceViewModel>this.doc.getBlock(this.doc.addBlock(
                            PlaceViewFlavour,
                            {
                                requestIds: [placeViewRequest.id],
                            },
                            plainBlockView
                        ))!.model
                    }
                }))

                return disposable
            },
            this.doc
        )

        this._lookup = observation.results
        this.disposables.add(observation.disposable)
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [PlainBlockViewFlavour]: PlainBlockViewService
        }
    }
}

export const StackedPlainBlockViewFlavour = `${PlainBlockViewFlavour}-stacked`

export interface StackedPlainBlockViewProps extends PlainBlockViewProps {
}

export const StackedPlainBlockViewSchema = defineBlockSchema({
    flavour: StackedPlainBlockViewFlavour,
    props: (): StackedPlainBlockViewProps => ({
        requestIds: [BlockID_none],

        blockId: BlockID_none,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type StackedPlainBlockViewModel = SchemaToModel<typeof StackedPlainBlockViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [StackedPlainBlockViewFlavour]: StackedPlainBlockViewModel
        }
    }
}

export class StackedPlainBlockViewService extends BlockService<StackedPlainBlockViewModel> {
    private _lookup!: ObservationLookup<BlockID, StackedPlainBlockViewModel>

    get lookup() {
        return this._lookup
    }

    override mounted(): void {
        const observation = flavouredObservationLookup<BlockID, typeof StackedPlainBlockViewFlavour>(
            StackedPlainBlockViewFlavour,
            stackedPlainBlockView => stackedPlainBlockView.blockId,
            async stackedPlainBlockView => {
                const block = this.doc.getBlock(stackedPlainBlockView.blockId)!.model

                const disposable = new DisposableGroup()

                disposable.add(observeChildren(block, child => {
                    let viewRequest = await awaitChild<BlockViewRequestModel>(stackedPlainBlockView, viewRequest =>
                        viewRequest.flavour === BlockViewRequestFlavour &&
                        viewRequest.blockId === child.id
                    )

                    if (!viewRequest) {
                        viewRequest = <BlockViewRequestModel>this.doc.getBlock(this.doc.addBlock(
                            BlockViewRequestFlavour,
                            {
                                blockId: child.id,
                            },
                            stackedPlainBlockView
                        ))!.model
                    }

                    let placeViewRequest = (<PlaceViewRequestModel[]>stackedPlainBlockView.children).find(placeViewRequest =>
                        placeViewRequest.flavour === PlaceViewRequestFlavour &&
                        placeViewRequest.viewRequestId === viewRequest?.id
                    )

                    if (!placeViewRequest) {
                        placeViewRequest = <PlaceViewRequestModel>this.doc.getBlock(this.doc.addBlock(
                            PlaceViewRequestFlavour,
                            {
                                viewRequestId: viewRequest.id
                            },
                            stackedPlainBlockView
                        ))!.model
                    }

                    let placeView = (<PlaceViewModel[]>stackedPlainBlockView.children).find(placeView =>
                        placeView.flavour === PlaceViewFlavour &&
                        placeView.requestIds.includes(placeViewRequest!.id)
                    )

                    if (!placeView) {
                        placeView = <PlaceViewModel>this.doc.getBlock(this.doc.addBlock(
                            PlaceViewFlavour,
                            {
                                requestIds: [placeViewRequest.id],
                            },
                            stackedPlainBlockView
                        ))!.model
                    }
                }))

                return disposable
            },
            this.doc
        )

        this._lookup = observation.results
        this.disposables.add(observation.disposable)
    }
}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [PlainBlockViewFlavour]: PlainBlockViewService
        }
    }
}

export const RelViewFlavour = `${ViewFlavour}-rel`

export const ConnectorRelViewFlavour = `${RelViewFlavour}-connector`
export interface ConnectorRelViewProps extends ViewProps {
    from_blockViewRequestId: BlockID
    from_blockPlaceViewRequestId: BlockID
    to_blockViewRequestId: BlockID
    to_blockPlaceViewRequestId: BlockID
    connectorId: unknown
}

export const ConnectorRelViewSchema = defineBlockSchema({
    flavour: ConnectorRelViewFlavour,
    props: (): ConnectorRelViewProps => ({
        requestIds: [BlockID_none],

        from_blockViewRequestId: BlockID_none,
        from_blockPlaceViewRequestId: BlockID_none,
        to_blockViewRequestId: BlockID_none,
        to_blockPlaceViewRequestId: BlockID_none,

        connectorId: 1,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export const EmbedObjRelViewFlavour = `${RelViewFlavour}-embed`
export interface EmbedObjRelViewProps extends ViewProps {
    obj_blockViewRequestId: BlockID
    obj_connectorId: unknown
}

export const EmbedObjRelViewSchema = defineBlockSchema({
    flavour: EmbedObjRelViewFlavour,
    props: (): EmbedObjRelViewProps => ({
        requestIds: [BlockID_none],

        obj_blockViewRequestId: BlockID_none,
        obj_connectorId: 0,
    }),
    metadata: {
        role: "hub",
        version: 1,
    }
})

export type EmbedObjRelViewModel = SchemaToModel<typeof EmbedObjRelViewSchema>

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [EmbedObjRelViewFlavour]: EmbedObjRelViewModel
        }
    }
}

@customElement(EmbedObjRelViewFlavour)
export class EmbedObjRelViewElement extends BlockElement<EmbedObjRelViewModel> {
    override renderBlock() {
        const request = <RelViewRequestModel>this.doc.getBlock(this.model.requestIds[0]!)?.model!

        return html`<div>
            ${request.relation}
            ${this.renderChildren(this.model)}
        </div>`
    }
}

export class EmbedObjRelViewGenerator implements ViewGenerator {
    view(request: ViewRequestModel, spec: SpecStore): void | Disposable {
        const request_typed = <RelViewRequestModel><unknown>request
        if (request_typed.flavour !== RelViewRequestFlavour)
            return

        const doc = spec.std.doc
        const service_embedObjRelView = spec.getService(EmbedObjRelViewFlavour)
        
        const view = doc.getBlock(doc.addBlock(EmbedObjRelViewFlavour, {
            requestIds: [request.id],
            obj_connectorId: undefined,
            obj_blockViewRequestId: spec.getService(BlockViewRequestFlavour).
        }))
    }
}

export class EmbedObjRelViewService extends BlockService<EmbedObjRelViewModel> {

}

declare global {
    namespace BlockSuite {
        interface BlockServices {
            [EmbedObjRelViewFlavour]: EmbedObjRelViewService
        }
    }
}