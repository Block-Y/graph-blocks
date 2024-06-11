import { BlockModel, Block, Slot, defineBlockSchema, SchemaToModel } from "@blocksuite/store";
import { BlockElement, BlockService, PathFinder } from "@blocksuite/block-std"
import { DisposableGroup, Disposable } from "@blocksuite/global/utils";
import { DisposableResults, ObservableSet, observeChildren, reactive } from "../utils.js";
import { customElement } from "lit/decorators.js";
import { TemplateResult, nothing } from "lit";
import { choose } from "lit/directives/choose.js";

export const ViewRequestRootFlavour = "view-requestroot"
export type ViewRequestRootFlavour = typeof ViewRequestRootFlavour

export const ViewRootFlavour = "view-root"
export type ViewRootFlavour = typeof ViewRootFlavour

export const ViewRequestFlavour = "view-request"
export type ViewRequestFlavour = typeof ViewRequestFlavour
export type ViewRequestFlavourType = `${ViewRequestFlavour}${string}` & BlockSuite.Flavour

export const ViewFlavour = "view"
export type ViewFlavour = typeof ViewFlavour
export type ViewFlavourType = `${ViewFlavour}${string}` & BlockSuite.Flavour

export const BlockViewRequestFlavour = `${ViewRequestFlavour}-block`
export type BlockViewRequestFlavour = typeof BlockViewRequestFlavour
export const BlockViewFlavour = `${ViewFlavour}-block`
export type BlockViewFlavour = typeof BlockViewFlavour

export const RelationshipViewRequestFlavour = `${ViewRequestFlavour}-relationship`
export type RelationshipViewRequestFlavour = typeof RelationshipViewRequestFlavour
export const RelationshipViewModelFlavour = `${ViewFlavour}-relationship`
export type RelationshipViewModelFlavour = typeof RelationshipViewModelFlavour

export const DirectedRelationshipViewRequestFlavour = `${RelationshipViewRequestFlavour}-directed`
export type DirectedRelationshipViewRequestFlavour = typeof DirectedRelationshipViewRequestFlavour
export const DirectedRelationshipViewModelFlavour = `${RelationshipViewModelFlavour}-directed`
export type DirectedRelationshipViewModelFlavour = typeof DirectedRelationshipViewModelFlavour

export interface ViewRequestRootProps {
}

export interface ViewRootProps {
}

export interface ViewRequestProps {
    containingElementPath: string
}

export interface ViewProps {
}

export interface BlockViewRequestProps extends ViewRequestProps {
    blockId: BlockModel["id"]
}

export interface BlockViewProps extends ViewProps {
    blockId: BlockModel["id"]
}

export const ViewRequestRootSchema = defineBlockSchema({
    flavour: ViewRequestRootFlavour,
    metadata: {
        role: "hub",
        version: 1,
    },
    props: (internal): ViewRequestRootProps => ({
    }),
})

export const ViewRequestSchema = defineBlockSchema({
    flavour: ViewRequestFlavour,
    metadata: {
        role: 'hub',
        version: 1,
        parent: [ViewRequestFlavour],
    },
    props: (internal): ViewRequestProps => ({
        containingElementPath: '',
    }),
})

export type ViewRequestRootModel = SchemaToModel<typeof ViewRequestRootSchema>
export type ViewRequestModel<Flavour extends ViewRequestFlavourType = ViewRequestFlavourType> = Omit<SchemaToModel<typeof ViewRequestSchema>, "flavour"> & { flavour: Flavour }

export interface ViewRequestSolution<
        Request extends ViewRequestModel = ViewRequestModel
    > {
    get request(): Request
    get cost(): number
    
    implement(service: ViewRequestService): Disposable
}

export interface ViewRequestSolver {
    solve(request: ViewRequestModel, service: ViewRequestService): DisposableResults<ObservableSet<ViewRequestSolution>> | void
}

export class ViewRequestService extends BlockService<ViewRequestModel> {
    private root!: ViewRequestRootModel

    readonly solvers = new ObservableSet<ViewRequestSolver>()

    request<Flavour extends ViewRequestFlavourType = ViewRequestFlavourType>(flavour: Flavour, props: BlockSuite.ModelProps<BlockSuite.BlockModels[Flavour]>): BlockSuite.BlockModels[Flavour]
    request(flavour: string, props: object) {
        return this.doc.addBlock(<never>flavour, props, this.root)
    }

    override mounted() {
        this.root = <ViewRequestRootModel>(
            this.doc.getBlocksByFlavour(ViewRequestRootFlavour).at(0) ??
            this.doc.getBlock(this.doc.addBlock(ViewRequestRootFlavour, {}))!
        ).model

        observeChildren(this.root, (request: ViewRequestModel) => {
            const disposable = new DisposableGroup()

            const solutions = new ObservableSet<ViewRequestSolution>()

            disposable.add(this.solvers.observe(solver => {
                const solverSolutions = solver.solve(request, this)
                if (!solverSolutions)
                    return

                const disposable = new DisposableGroup()
                disposable.add(solverSolutions.disposable)

                disposable.add(solverSolutions.results.observe(solution => {
                    solutions.add(solution)

                    return {
                        dispose() {
                            solutions.delete(solution)
                        },
                    }
                }))

                return disposable
            }))

            let activeSolution: ViewRequestSolution | undefined
            let activeSolutionDisposable: Disposable | undefined

            const chooseSolution = () => {
                const solutions_sorted = [...solutions.values()].sort((a, b) => b.cost - a.cost)
                const solution = solutions_sorted.at(0)

                if (!solution)
                    throw new Error("no solutions")

                if (solution !== activeSolution && activeSolutionDisposable)
                    activeSolutionDisposable.dispose()

                activeSolution = solution
                activeSolutionDisposable = solution.implement(this)
            }

            disposable.add(solutions.slots.changed.on(() => chooseSolution()))
            chooseSolution()

            disposable.add(() => activeSolutionDisposable?.dispose())

            return disposable
        })
    }
}

declare global {
    namespace BlockSuite {
        interface BlockModels {
            [ViewRequestRootFlavour]: ViewRequestRootModel
            [ViewRequestFlavour]: ViewRequestModel
            [BlockViewRequestFlavour]: BlockViewRequestModel
            [RelationshipViewRequestFlavour]: RelationshipViewRequestModel
            [DirectedRelationshipViewRequestFlavour]: DirectedRelationshipViewRequestModel
        }

        interface BlockServices {
            [ViewRequestFlavour]: ViewRequestService
            [BlockViewFlavour]: BlockViewService
            [BlockViewRequestFlavour]: BlockViewRequestService
        }
    }
}

export interface RelationshipViewRequestProps<
        Relationship extends string = string
    > {
    relationship: Relationship
}

export const RelationshipViewRequestSchema = defineBlockSchema({
    flavour: RelationshipViewRequestFlavour,
    props: (internal): RelationshipViewRequestProps => ({
        relationship: "",
    }),
    metadata: {
        role: "content",
        version: 1,
    }
})

export type RelationshipViewRequestSchema<
        Relationship extends string = string,
        Flavour extends `${RelationshipViewRequestFlavour}${string}` = RelationshipViewRequestFlavour,
    > =
    typeof RelationshipViewRequestSchema & {
        model: Omit<typeof RelationshipViewRequestSchema["model"], "props"> & {
            flavour: Flavour
            props: Omit<typeof RelationshipViewRequestSchema["model"]["props"], "relationship"> & {
                relationship: Relationship
            }
        }
    }

export type RelationshipViewRequestModel<
        Relationship extends string = string,
        RealModels extends BlockModel[] = BlockModel[],
        Flavour extends `${RelationshipViewRequestFlavour}${string}` = RelationshipViewRequestFlavour,
    > =
    Omit<SchemaToModel<RelationshipViewRequestSchema<Relationship, Flavour>>, "children"> & {
    children: RealModels
}

export interface DirectedRelationshipViewRequestProps<
        Relationship extends string = string
    > extends RelationshipViewRequestProps<Relationship> {
    from: BlockModel["id"]
    to: BlockModel["id"]
}

export type DirectedRelationshipViewRequestModel<
        Relationship extends string = string,
        FromModel extends BlockModel = BlockModel,
        ToModel extends BlockModel = BlockModel,
    > =
    RelationshipViewRequestModel<Relationship, [from: FromModel, to: ToModel], DirectedRelationshipViewRequestFlavour> & {
    fromBlock: FromModel
    toBlock: ToModel
}

export const BlockViewSchema = defineBlockSchema({
    flavour: BlockViewFlavour,
    props: (internal): BlockViewProps => ({
        blockId: "",
    }),
    metadata: {
        role: "content",
        version: 1,
    }
})

export interface BlockViewModel<
        RealModel extends BlockModel = BlockModel,
    > extends Omit<SchemaToModel<typeof BlockViewSchema>, "flavour"> {
    flavour: BlockViewFlavour
    
    block: Block & { model: RealModel }
    blockModel: RealModel
    blockChanged: Slot<{
        old: RealModel
        new: RealModel
    }>
}

export const BlockViewRequestSchema = defineBlockSchema({
    flavour: BlockViewRequestFlavour,
    props: (internal): BlockViewRequestProps => ({
        blockId: "",
        containingElementPath: "",
    }),
    metadata: {
        role: "content",
        version: 1,
    }
})

export interface BlockViewRequestModel extends SchemaToModel<typeof BlockViewRequestSchema> {
}

@customElement(BlockViewRequestFlavour)
export class BlockViewRequestView extends BlockElement<BlockViewRequestModel, BlockViewRequestService> {
    private isSelected = false

    private readonly volunteer: BlockViewContainerVolunteer = {
        changed: new Slot(),

        canRender: request =>
            request.containingElementPath ===
            PathFinder.pathToKey(this.path),
        
        renderBlock: block => {
            if (block.id !== this.model.blockId)
                throw new Error("cannot render except specific block")

            this.isSelected = true
            return {
                dispose: () => {
                    this.isSelected = false
                    this.requestUpdate()
                },
            }
        },
    }

    override connectedCallback(): void {
        this.service.volunteerBlockViewContainers.add(this.volunteer)
    }

    override disconnectedCallback(): void {
        this.service.volunteerBlockViewContainers.delete(this.volunteer)
    }

    override renderBlock() {
        return choose(
            this.isSelected,
            [
                [true, () => this.renderChildren({
                    children: [this.doc.getBlock(this.model.blockId)!.model]
                } as BlockModel)],
                [false, () => nothing as unknown as TemplateResult]
            ]
        )
    }
}

export class BlockViewRequestSolution implements ViewRequestSolution<BlockViewRequestModel> {
    readonly cost = 1
    
    constructor(
        public readonly request: BlockViewRequestModel,
        public readonly containerVolunteer: BlockViewContainerVolunteer,
    ) { }

    implement(service: ViewRequestService): Disposable {
        const blockViewService = service.std.spec.getService(BlockViewRequestFlavour)
        const blockModel = service.doc.getBlock(this.request.blockId)!.model

        const blockViewContainerSelection = blockViewService.selectionContainer(blockModel)
        const containerVolunteer = this.containerVolunteer

        blockViewContainerSelection.selection.set(containerVolunteer)

        return {
            dispose() {
                blockViewContainerSelection.selection.delete(containerVolunteer)
            }
        }
    }
}

export class BlockViewRequestSolver implements ViewRequestSolver {
    solve(request: ViewRequestModel, service: ViewRequestService) {
        type Request = BlockViewRequestModel
        const realBlock_request = <Request>request
        if (!(('blockId' satisfies keyof Request) in realBlock_request))
            return

        const blockViewService = service.std.spec.getService(BlockViewRequestFlavour)

        const disposable = new DisposableGroup()

        const solutions = new ObservableSet<BlockViewRequestSolution>()

        disposable.add(blockViewService.volunteerBlockViewContainers.observe(volunteer => {
            const disposable = new DisposableGroup()
            let solution: BlockViewRequestSolution

            const evaluate = () => {
                const isEligibleNow = volunteer.canRender(realBlock_request)
                const wasEligible = solution !== undefined

                if (isEligibleNow) {
                    if (wasEligible)
                        solutions.delete(solution)

                    solution = new BlockViewRequestSolution(realBlock_request, volunteer)

                    solutions.add(solution)
                }
            }

            disposable.add(volunteer.changed.on(() => evaluate()))
            disposable.add(() => {
                if (solution)
                    solutions.delete(solution)
            })

            return disposable
        }))

        disposable.add(solutions)

        return {
            results: solutions,
            disposable
        }
    }
}

interface BlockViewContainerVolunteer {
    changed: Slot
    
    canRender(request: BlockViewRequestModel): boolean
    renderBlock(request: BlockViewRequestModel): Disposable
}

class BlockViewContainerSelection implements Disposable {
    readonly volunteers = new ObservableSet<BlockViewContainerVolunteer>()
    readonly selection = new ObservableSet<BlockViewContainerVolunteer>()

    private readonly renderDisposables = new Map<BlockViewContainerVolunteer, Disposable>()
    private readonly disposable = new DisposableGroup()

    constructor(readonly block: BlockModel) {
        this.disposable.add(this.volunteers)
        this.disposable.add(this.selection)

        this.disposable.add(this.selection.slots.add.on(volunteer => {
            this.renderDisposables.set(volunteer, volunteer.renderBlock(this.block))
        }))
        this.disposable.add(this.selection.slots.delete.on(volunteer => {
            this.renderDisposables.get(volunteer)!.dispose()
            this.renderDisposables.delete(volunteer)
        }))

        this.disposable.add(block.deleted.on(() => {
            this.dispose()
        }))
    }

    dispose() {
        this.disposable.dispose()
        this.renderDisposables.forEach(disposable => disposable.dispose())
    }
}

export class BlockViewRequestService extends BlockService<BlockViewRequestModel> {
    readonly volunteerBlockViewContainers = new ObservableSet<BlockViewContainerVolunteer>()
    
    readonly blockViewContainerSelections = new Map<BlockModel, BlockViewContainerSelection>()

    selectionContainer(block: BlockModel) {
        const existing = this.blockViewContainerSelections.get(block)
        if (existing)
            return existing

        const newContainer = new BlockViewContainerSelection(block)
        this.blockViewContainerSelections.set(block, newContainer)
        block.deleted.on(() => this.blockViewContainerSelections.delete(block))
        return newContainer
    }
}

export class BlockViewService extends BlockService<BlockViewModel> {
    override mounted() {
        const updateBlock = (viewModel: BlockViewModel) => {
            viewModel.block = this.doc.getBlock(viewModel.blockId)!
            viewModel.blockModel = viewModel.block.model
            return viewModel.blockModel
        }

        this.disposables.add(this.specSlots.viewConnected.on(({ component }) => {
            const viewModel = component.model as BlockViewModel

            if (viewModel.blockModel?.id !== viewModel.blockId)
                updateBlock(viewModel)

            viewModel.propsUpdated.on(({ key }) => {
                if (key === ('blockId') satisfies keyof BlockViewProps) {
                    const prev = viewModel.blockModel

                    viewModel.blockChanged.emit({
                        new: updateBlock(viewModel),
                        old: prev,
                    })
                }
            })
        }))
    }
}

export const CanvasChildrenViewFlavour = `${ViewFlavour}-canvas`
export type CanvasChildrenViewFlavour = typeof CanvasChildrenViewFlavour

export const CanvasChildViewFlavour = `${CanvasChildrenViewFlavour}-child`
export type CanvasChildViewFlavour = typeof CanvasChildViewFlavour

export type CanvasChildrenViewProps = {

}

export type CanvasChildViewProps = {
    requestId: BlockModel["id"]
}

export class CanvasChildrenViewModel extends BlockModel<CanvasChildrenViewProps> {
}

export class CanvasChildViewModel extends BlockModel<CanvasChildViewProps> {
}

export const CanvasChildrenViewSchema = defineBlockSchema({
    flavour: CanvasChildrenViewFlavour,
    props: (internal): CanvasChildrenViewProps => ({
    }),
    metadata: {
        role: "hub",
        version: 1,
    },
    toModel: () => new CanvasChildrenViewModel(),
})

export const CanvasChildViewSchema = defineBlockSchema({
    flavour: CanvasChildViewFlavour,
    props: (internal): CanvasChildViewProps => ({
        requestId: "",
    }),
    metadata: {
        role: "hub",
        version: 1,
    },
    toModel: () => new CanvasChildViewModel(),
})

@customElement(ViewRequestFlavour)
export class ViewRequestView extends BlockElement<ViewRequestModel, ViewRequestService> {
    override connectedCallback(): void {
        
    }
}

export class CanvasChildViewElement extends BlockElement<CanvasChildViewModel> {
    private readonly volunteer: BlockViewContainerVolunteer = {
        canRender: request =>
            request.id === this.model.requestId,
        
        renderBlock: () => {
            
        }
    }
}

@customElement(CanvasChildrenViewFlavour)
export class CanvasChildrenViewElement extends BlockElement<CanvasChildrenViewModel> {
    private readonly volunteer: BlockViewContainerVolunteer = {
        canRender: request =>
            request.containingElementPath.startsWith(PathFinder.pathToKey(this.path)),

        renderBlock: request => {
            const requestService = this.std.spec.getService(ViewRequestFlavour)
            const canvasChildViewRequestBlock = requestService.request(BlockViewRequestFlavour, {
                blockId: request.blockId
            })

            this.doc.moveBlocks([block], this.model)

            return {
                dispose: () => {
                    
                },
            }
        }
    }
    
    override connectedCallback(): void {
        
    }

    override disconnectedCallback(): void {
        
    }
}