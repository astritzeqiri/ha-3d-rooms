import {
  Extension,
  ExtensionProperty,
  PropertyType,
  TextureChannel,
  TextureInfo,
} from "@gltf-transform/core";

/** EXT_materials_bump (Blender exports), which glTF Transform would otherwise drop. */
const NAME = "EXT_materials_bump";

export class Bump extends ExtensionProperty {
  static EXTENSION_NAME = NAME;
  init() {
    this.extensionName = NAME;
    this.propertyType = "Bump";
    this.parentTypes = [PropertyType.MATERIAL];
  }
  getDefaults() {
    return Object.assign(super.getDefaults(), {
      bumpFactor: 1,
      bumpTexture: null,
      bumpTextureInfo: new TextureInfo(this.graph, "bumpTextureInfo"),
    });
  }
  getBumpFactor() {
    return this.get("bumpFactor");
  }
  setBumpFactor(factor) {
    return this.set("bumpFactor", factor);
  }
  getBumpTexture() {
    return this.getRef("bumpTexture");
  }
  getBumpTextureInfo() {
    return this.getRef("bumpTexture") ? this.getRef("bumpTextureInfo") : null;
  }
  setBumpTexture(texture) {
    return this.setRef("bumpTexture", texture, {
      channels: TextureChannel.R,
      isColor: false,
    });
  }
}

export class EXTMaterialsBump extends Extension {
  static EXTENSION_NAME = NAME;
  extensionName = NAME;
  prereadTypes = [PropertyType.MESH];
  prewriteTypes = [PropertyType.MESH];
  read() {
    return this;
  }
  write() {
    return this;
  }
  preread(context) {
    const { json } = context.jsonDoc;
    const textures = json.textures || [];
    (json.materials || []).forEach((materialDef, index) => {
      const def = materialDef.extensions?.[NAME];
      if (!def) return;
      const bump = new Bump(this.document.getGraph());
      context.materials[index].setExtension(NAME, bump);
      if (def.extras) bump.setExtras(def.extras);
      if (def.bumpFactor !== undefined) bump.setBumpFactor(def.bumpFactor);
      if (def.bumpTexture !== undefined) {
        const info = def.bumpTexture;
        bump.setBumpTexture(context.textures[textures[info.index].source]);
        context.setTextureInfo(bump.getBumpTextureInfo(), info);
      }
    });
    return this;
  }
  prewrite(context) {
    const { json } = context.jsonDoc;
    for (const material of this.document.getRoot().listMaterials()) {
      const bump = material.getExtension(NAME);
      if (!bump) continue;
      const def = context.createPropertyDef(bump);
      def.bumpFactor = bump.getBumpFactor();
      if (bump.getBumpTexture())
        def.bumpTexture = context.createTextureInfoDef(
          bump.getBumpTexture(),
          bump.getBumpTextureInfo(),
        );
      const materialDef =
        json.materials[context.materialIndexMap.get(material)];
      materialDef.extensions = { ...materialDef.extensions, [NAME]: def };
    }
    return this;
  }
}
