import { AnnotationPoint } from './note';

export function validateAnnotationPoint(p: AnnotationPoint): void {
  if (p.x < 0 || p.x > 1) {
    throw new Error(`Annotation point x out of bounds: ${p.x}`);
  }
  if (p.y < 0 || p.y > 1) {
    throw new Error(`Annotation point y out of bounds: ${p.y}`);
  }
}
