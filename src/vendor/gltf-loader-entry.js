import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

function createGLTFLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

export { GLTFLoader, MeshoptDecoder, createGLTFLoader };
