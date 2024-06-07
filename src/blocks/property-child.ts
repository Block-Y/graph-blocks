import { BlockModel, defineBlockSchema } from "@blocksuite/store";

export const PropertyChildFlavour = "property-child"
export type PropertyChildFlavour = typeof PropertyChildFlavour

export interface PropertyChildProps {
    property: string
    childBlockId: BlockModel["id"]
}

export const PropertyChildSchema = defineBlockSchema({
    flavour: PropertyChildFlavour,
    metadata: {
        role: "content",
        version: 1,
    },
    props: (internal): PropertyChildProps => ({
        property: "",
        childBlockId: "",
    }),
    toModel: () => new PropertyChildModel()
})

export class PropertyChildModel extends BlockModel<PropertyChildProps> {
    
}