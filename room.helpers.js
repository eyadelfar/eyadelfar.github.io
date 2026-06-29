import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeHelpers(scene) {
  function mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.5,
      metalness: opts.metalness ?? 0.0,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      side: opts.side ?? THREE.FrontSide
    });
  }

  function physMat(color, opts = {}) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: opts.roughness ?? 0.4,
      metalness: opts.metalness ?? 0.0,
      clearcoat: opts.clearcoat ?? 0.0,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.2,
      transmission: opts.transmission ?? 0,
      thickness: opts.thickness ?? 0,
      ior: opts.ior ?? 1.45,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      side: opts.side ?? THREE.FrontSide
    });
  }

  function box(name, size, pos, material, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function rbox(name, size, pos, material, parent = scene, radius = 0.02, segs = 4) {
    const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
    const m = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], segs, Math.max(r, 0.001)), material);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function cylinder(name, rTop, rBot, h, segs, pos, material, parent = scene) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function plane(name, w, h, pos, rot, material, parent = scene) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.name = name;
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function sphere(name, r, segs, pos, material, parent = scene) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), material);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function roundedCanvasTexture(draw, w = 1024, h = 512) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return { canvas: c, ctx, tex };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
    const words = String(text).split(' ');
    let line = '';
    let lines = 0;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
        lines++;
        if (lines >= maxLines - 1) return y;
      } else { line = testLine; }
    }
    ctx.fillText(line.trim(), x, y);
    return y + lineHeight;
  }

  return { mat, physMat, box, rbox, cylinder, plane, sphere, roundedCanvasTexture, roundRect, wrapText };
}
