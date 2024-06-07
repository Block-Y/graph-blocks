import { defineBlockSchema } from "@blocksuite/store"
import { BlockSpec } from "@blocksuite/block-std";
import * as Y from 'yjs'

export const NaturalTextBlockSchema = defineBlockSchema({
    flavour: 'natural-text',
    props: internal => ({
        text: internal.Text,
    }),
    metadata: {
        version: 1,
        role: 'hub',
    }
})

export const NaturalTextBlockSpec: BlockSpec = {
    schema: NaturalTextBlockSchema,
    
}