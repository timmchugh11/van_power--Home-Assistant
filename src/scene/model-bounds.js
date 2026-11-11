import { Box3, Vector3 } from "vendor:three";

export function getBaseGeometryBox(geometry) {
  if (geometry.userData.__basePositionBox) {
    return geometry.userData.__basePositionBox.clone();
  }
  const position = geometry.attributes?.position;
  const box = new Box3();
  if (!position) {
    box.makeEmpty();
    return box;
  }
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max2 = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max2.x) max2.x = x;
    if (y > max2.y) max2.y = y;
    if (z > max2.z) max2.z = z;
  }
  box.min.copy(min);
  box.max.copy(max2);
  geometry.userData.__basePositionBox = box.clone();
  return box;
}
