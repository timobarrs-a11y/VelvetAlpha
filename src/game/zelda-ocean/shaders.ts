export const oceanVertexShader = `
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveHeight;
  uniform float uWaveFrequency;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying vec2 vUv;

  float wave(vec2 pos, float frequency, float speed, float phase) {
    return sin(pos.x * frequency + uTime * speed + phase) *
           cos(pos.y * frequency * 0.7 + uTime * speed * 0.8 + phase * 1.3);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    float w1 = wave(pos.xz, uWaveFrequency, uWaveSpeed, 0.0);
    float w2 = wave(pos.xz, uWaveFrequency * 2.1, uWaveSpeed * 1.3, 1.5);
    float w3 = wave(pos.xz, uWaveFrequency * 0.5, uWaveSpeed * 0.7, 3.2);

    float combinedWave = (w1 * 0.6 + w2 * 0.25 + w3 * 0.15) * uWaveHeight;
    pos.y += combinedWave;
    vWaveHeight = combinedWave;

    vec3 neighbX = pos + vec3(0.5, 0.0, 0.0);
    float nwX = wave(neighbX.xz, uWaveFrequency, uWaveSpeed, 0.0) * 0.6 +
                wave(neighbX.xz, uWaveFrequency * 2.1, uWaveSpeed * 1.3, 1.5) * 0.25;
    neighbX.y += nwX * uWaveHeight;

    vec3 neighbZ = pos + vec3(0.0, 0.0, 0.5);
    float nwZ = wave(neighbZ.xz, uWaveFrequency, uWaveSpeed, 0.0) * 0.6 +
                wave(neighbZ.xz, uWaveFrequency * 2.1, uWaveSpeed * 1.3, 1.5) * 0.25;
    neighbZ.y += nwZ * uWaveHeight;

    vec3 tangent = normalize(neighbX - pos);
    vec3 bitangent = normalize(neighbZ - pos);
    vNormal = normalize(cross(bitangent, tangent));
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const oceanFragmentShader = `
  uniform vec3 uColorShallow;
  uniform vec3 uColorDeep;
  uniform vec3 uColorCrest;
  uniform vec3 uSunDirection;
  uniform float uTime;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying vec2 vUv;

  float celShade(float value, int steps) {
    return floor(value * float(steps)) / float(steps);
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(uSunDirection);

    float diffuse = max(dot(normal, sunDir), 0.0);
    float celDiffuse = celShade(diffuse, 3);

    vec3 baseColor = mix(uColorDeep, uColorShallow, clamp(vWaveHeight + 0.5, 0.0, 1.0));
    float crestFactor = smoothstep(0.4, 0.8, vWaveHeight);
    baseColor = mix(baseColor, uColorCrest, crestFactor * 0.5);

    float foam = smoothstep(0.5, 0.9, vWaveHeight);
    baseColor = mix(baseColor, uColorCrest, foam * 0.7);

    vec3 finalColor = baseColor * (0.3 + celDiffuse * 0.7);

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-sunDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    float celSpec = step(0.7, spec);
    finalColor += uColorCrest * celSpec * 0.4;

    float edgeLines = step(0.96, abs(sin(vUv.x * 30.0 + uTime * 0.5)) *
                                 abs(sin(vUv.y * 20.0 + uTime * 0.3)));
    finalColor = mix(finalColor, finalColor * 0.8, edgeLines * 0.15);

    gl_FragColor = vec4(finalColor, 0.88);
  }
`;

export const skyVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragmentShader = `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform float uHorizonBlend;

  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition).y;
    float t = pow(max(h, 0.0), uHorizonBlend);
    vec3 color = mix(uHorizonColor, uTopColor, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const celVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vNormal = normalMatrix * normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const celFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uSunDirection;
  uniform float uOutlineWidth;
  uniform vec3 uOutlineColor;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  float celShade(float value) {
    if (value > 0.8) return 1.0;
    if (value > 0.5) return 0.7;
    if (value > 0.2) return 0.4;
    return 0.2;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(uSunDirection);
    float diffuse = max(dot(normal, sunDir), 0.0);
    float cel = celShade(diffuse);

    vec3 color = uColor * cel;

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    float rimLine = step(0.85, rim);
    color = mix(color, uOutlineColor, rimLine * 0.8);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const rupeeVertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  void main() {
    vNormal = normalMatrix * normal;
    vec3 pos = position;
    pos.y += sin(uTime * 3.0) * 0.3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const rupeeFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormal;

  void main() {
    vec3 normal = normalize(vNormal);
    float fresnel = 1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0)));
    float glow = sin(uTime * 4.0) * 0.5 + 0.5;
    vec3 color = uColor * (0.7 + fresnel * 0.6) * (0.85 + glow * 0.15);
    gl_FragColor = vec4(color, 1.0);
  }
`;
