import {
  TypeInfo,
  visit,
  visitWithTypeInfo,
  Kind,
  DocumentNode,
  ASTVisitor,
  GraphQLSchema,
  DefinitionNode,
} from 'graphql';
import type { Comment } from 'estree';
import type { GraphQLESTreeNode, TypeInformation } from './types';
import { convertLocation } from './utils';

export function convertToESTree<T extends DocumentNode>(node: T, schema?: GraphQLSchema) {
  const typeInfo = schema ? new TypeInfo(schema) : null;

  const visitor: ASTVisitor = {
    leave(node, key, parent) {
      const leadingComments: Comment[] =
        'description' in node && node.description
          ? [
              {
                type: node.description.block ? 'Block' : 'Line',
                value: node.description.value,
              },
            ]
          : [];

      const calculatedTypeInfo: TypeInformation | Record<string, never> = typeInfo
        ? {
            argument: typeInfo.getArgument(),
            defaultValue: typeInfo.getDefaultValue(),
            directive: typeInfo.getDirective(),
            enumValue: typeInfo.getEnumValue(),
            fieldDef: typeInfo.getFieldDef(),
            inputType: typeInfo.getInputType(),
            parentInputType: typeInfo.getParentInputType(),
            parentType: typeInfo.getParentType(),
            gqlType: typeInfo.getType(),
          }
        : {};

      const rawNode = () => {
        if (parent && key !== undefined) {
          return parent[key];
        }
        return node.kind === Kind.DOCUMENT
          ? <DocumentNode>{
              ...node,
              definitions: node.definitions.map(definition =>
                (definition as unknown as GraphQLESTreeNode<DefinitionNode>).rawNode()
              ),
            }
          : node;
      };

      const commonFields: Omit<GraphQLESTreeNode<typeof node>, 'parent'> = {
        ...node,
        type: node.kind,
        loc: convertLocation(node.loc),
        range: [node.loc.start, node.loc.end],
        leadingComments,
        // Use function to prevent RangeError: Maximum call stack size exceeded
        typeInfo: () => calculatedTypeInfo as any, // Don't know if can fix error
        rawNode,
      };

      return 'type' in node
        ? {
            ...commonFields,
            gqlType: node.type,
          }
        : commonFields;
    },
  };

  return visit(
    node,
    typeInfo ? visitWithTypeInfo(typeInfo, visitor) : visitor
  ) as GraphQLESTreeNode<T>;
}
