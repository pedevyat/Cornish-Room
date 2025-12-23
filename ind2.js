// ============================================
// Основные параметры сцены
// ============================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Фиксированные настройки качества
const FIXED_RESOLUTION = { width: 800, height: 600 };
const FIXED_ANTIALIASING = 2; // Средний антиалиасинг (2x)
const FIXED_MAX_DEPTH = 3;    // Глубина рекурсии

// Камера
const camera = {
    position: { x: 0, y: 1, z: 8 },
    lookAt: { x: 0, y: 1, z: 0 },
    fov: 60
};

// Свет
const lights = [
    {
        position: { x: 0, y: 1.9, z: 0 },
        color: { r: 1.0, g: 1.0, b: 1.0 },
        intensity: 1.2
    },
    {
        position: { x: 1.0, y: 1.5, z: -1.0 },
        color: { r: 0.8, g: 0.8, b: 1.0 },
        intensity: 0.7
    }
];

// Объекты сцены
let objects = [];

// ============================================
// Векторная математика
// ============================================
class Vector3 {
    constructor(x, y, z) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }

    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    subtract(v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    multiply(s) {
        return new Vector3(this.x * s, this.y * s, this.z * s);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalize() {
        const len = this.length();
        if (len === 0) return new Vector3(0, 0, 0);
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }

    distance(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // Для совместимости с обычными объектами
    static fromObject(obj) {
        return new Vector3(obj.x, obj.y, obj.z);
    }
}

// ============================================
// Классы объектов
// ============================================
class Material {
    constructor(color, reflection = 0, transparency = 0, refractionIndex = 1.5) {
        this.color = color;
        this.reflection = reflection; // 0-1 коэффициент отражения
        this.transparency = transparency; // 0-1 коэффициент прозрачности
        this.refractionIndex = refractionIndex;
        this.specular = 0.2; // Блик
        this.shininess = 32; // Размер блика
    }
}

class Sphere {
    constructor(center, radius, material) {
        this.center = center instanceof Vector3 ? center : new Vector3(center.x, center.y, center.z);
        this.radius = radius;
        this.material = material;
        this.type = 'sphere';
    }

    intersect(rayOrigin, rayDirection) {
        const rayOriginVec = rayOrigin instanceof Vector3 ? rayOrigin : Vector3.fromObject(rayOrigin);
        const rayDirectionVec = rayDirection instanceof Vector3 ? rayDirection : Vector3.fromObject(rayDirection);

        const oc = rayOriginVec.subtract(this.center);
        const a = rayDirectionVec.dot(rayDirectionVec);
        const b = 2.0 * oc.dot(rayDirectionVec);
        const c = oc.dot(oc) - this.radius * this.radius;
        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            return null;
        }

        const sqrtDisc = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        let t = null;
        if (t1 > 0.001) {
            t = t1;
        } else if (t2 > 0.001) {
            t = t2;
        }

        if (t === null) {
            return null;
        }

        const point = rayOriginVec.add(rayDirectionVec.multiply(t));
        const normal = point.subtract(this.center).normalize();
        return { t, point, normal, object: this };
    }
}

class Cube {
    constructor(min, max, material) {
        this.min = min instanceof Vector3 ? min : new Vector3(min.x, min.y, min.z);
        this.max = max instanceof Vector3 ? max : new Vector3(max.x, max.y, max.z);
        this.material = material;
        this.type = 'cube';
    }

    intersect(rayOrigin, rayDirection) {
        const rayOriginVec = rayOrigin instanceof Vector3 ? rayOrigin : Vector3.fromObject(rayOrigin);
        const rayDirectionVec = rayDirection instanceof Vector3 ? rayDirection : Vector3.fromObject(rayDirection);

        let tmin = (this.min.x - rayOriginVec.x) / rayDirectionVec.x;
        let tmax = (this.max.x - rayOriginVec.x) / rayDirectionVec.x;

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        let tymin = (this.min.y - rayOriginVec.y) / rayDirectionVec.y;
        let tymax = (this.max.y - rayOriginVec.y) / rayDirectionVec.y;

        if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

        if (tmin > tymax || tymin > tmax) return null;

        if (tymin > tmin) tmin = tymin;
        if (tymax < tmax) tmax = tymax;

        let tzmin = (this.min.z - rayOriginVec.z) / rayDirectionVec.z;
        let tzmax = (this.max.z - rayOriginVec.z) / rayDirectionVec.z;

        if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

        if (tmin > tzmax || tzmin > tmax) return null;

        if (tzmin > tmin) tmin = tzmin;
        if (tzmax < tmax) tmax = tzmax;

        if (tmin > 0.001) {
            const t = tmin;
            const point = rayOriginVec.add(rayDirectionVec.multiply(t));

            // Вычисляем нормаль
            let normal;
            const epsilon = 0.001;

            if (Math.abs(point.x - this.min.x) < epsilon) {
                normal = new Vector3(-1, 0, 0);
            } else if (Math.abs(point.x - this.max.x) < epsilon) {
                normal = new Vector3(1, 0, 0);
            } else if (Math.abs(point.y - this.min.y) < epsilon) {
                normal = new Vector3(0, -1, 0);
            } else if (Math.abs(point.y - this.max.y) < epsilon) {
                normal = new Vector3(0, 1, 0);
            } else if (Math.abs(point.z - this.min.z) < epsilon) {
                normal = new Vector3(0, 0, -1);
            } else {
                normal = new Vector3(0, 0, 1);
            }

            return { t, point, normal, object: this };
        }

        return null;
    }
}

class Plane {
    constructor(point, normal, material) {
        this.point = point instanceof Vector3 ? point : new Vector3(point.x, point.y, point.z);
        this.normal = (normal instanceof Vector3 ? normal : new Vector3(normal.x, normal.y, normal.z)).normalize();
        this.material = material;
        this.type = 'plane';
    }

    intersect(rayOrigin, rayDirection) {
        const rayOriginVec = rayOrigin instanceof Vector3 ? rayOrigin : Vector3.fromObject(rayOrigin);
        const rayDirectionVec = rayDirection instanceof Vector3 ? rayDirection : Vector3.fromObject(rayDirection);

        const denom = this.normal.dot(rayDirectionVec);
        if (Math.abs(denom) > 0.0001) {
            const t = this.point.subtract(rayOriginVec).dot(this.normal) / denom;
            if (t > 0.001) {
                const point = rayOriginVec.add(rayDirectionVec.multiply(t));
                return { t, point, normal: this.normal, object: this };
            }
        }
        return null;
    }
}

// ============================================
// Инициализация сцены
// ============================================
function initScene() {
    objects = [];

    // Материалы
    const redMaterial = new Material({ r: 0.8, g: 0.1, b: 0.1 });
    const greenMaterial = new Material({ r: 0.1, g: 0.8, b: 0.1 });
    const whiteMaterial = new Material({ r: 0.9, g: 0.9, b: 0.9 });
    const blueMaterial = new Material({ r: 0.2, g: 0.3, b: 0.8 });
    const yellowMaterial = new Material({ r: 0.9, g: 0.9, b: 0.2 });
    const purpleMaterial = new Material({ r: 0.7, g: 0.2, b: 0.8 });

    // Стены Cornell Box (5x5x5 метров)
    // Левая стена (красная)
    objects.push(new Plane(
        new Vector3(-2.5, 0, 0),
        new Vector3(1, 0, 0),
        redMaterial
    ));

    // Правая стена (зеленая)
    objects.push(new Plane(
        new Vector3(2.5, 0, 0),
        new Vector3(-1, 0, 0),
        greenMaterial
    ));

    // Задняя стена (белая)
    objects.push(new Plane(
        new Vector3(0, 0, -2.5),
        new Vector3(0, 0, 1),
        whiteMaterial
    ));

    // Пол (белый) - высота -2.5
    objects.push(new Plane(
        new Vector3(0, -2.5, 0),
        new Vector3(0, 1, 0),
        whiteMaterial
    ));

    // Потолок (белый)
    objects.push(new Plane(
        new Vector3(0, 2.5, 0),
        new Vector3(0, -1, 0),
        whiteMaterial
    ));

    // Начальные объекты
    // 1. Шар (желтый, непрозрачный, неотражающий)
    objects.push(new Sphere(
        new Vector3(-1.0, -1.8, -1.0),  // Y: -2.5 + 0.7 = -1.8 (лежит на полу)
        0.7,
        yellowMaterial
    ));

    // 2. Куб (синий)
    objects.push(new Cube(
        new Vector3(0.5, -2.5, 0.0),    // Нижняя точка куба на полу
        new Vector3(1.5, -1.5, 1.0),    // Верхняя точка куба (высота 1.0)
        blueMaterial
    ));

    // 3. Фиолетовый шар лежит на полу рядом с кубом
    objects.push(new Sphere(
        new Vector3(-0.5, -2.0, 0.5),   // Y: -2.5 + 0.5 = -2.0 (лежит на полу)
        0.5,
        purpleMaterial
    ));
}

// ============================================
// Функции рендеринга
// ============================================
function traceRay(rayOrigin, rayDirection, depth = 0) {
    if (depth > FIXED_MAX_DEPTH) {
        return { r: 0, g: 0, b: 0 };
    }

    // Находим ближайшее пересечение
    let closestIntersection = null;
    let closestDistance = Infinity;

    for (const obj of objects) {
        const intersection = obj.intersect(rayOrigin, rayDirection);
        if (intersection && intersection.t < closestDistance && intersection.t > 0.001) {
            closestDistance = intersection.t;
            closestIntersection = intersection;
        }
    }

    if (!closestIntersection) {
        // Фон - темно-серый вместо черного
        return { r: 0.05, g: 0.05, b: 0.1 };
    }

    const { point, normal, object } = closestIntersection;
    const material = object.material;

    // Вычисляем локальное освещение
    let localColor = { r: 0, g: 0, b: 0 };

    // Ambient свет
    const ambient = 0.15;
    localColor.r = material.color.r * ambient;
    localColor.g = material.color.g * ambient;
    localColor.b = material.color.b * ambient;

    // Проверяем каждый источник света
    for (const light of lights) {
        const lightPos = Vector3.fromObject(light.position);
        const lightDir = lightPos.subtract(point).normalize();
        const lightDistance = point.distance(lightPos);

        // Проверяем тени
        let inShadow = false;
        const shadowRayOrigin = point.add(normal.multiply(0.001));

        for (const obj of objects) {
            const shadowIntersection = obj.intersect(shadowRayOrigin, lightDir);
            if (shadowIntersection && shadowIntersection.t > 0.001 && shadowIntersection.t < lightDistance) {
                inShadow = true;
                break;
            }
        }

        if (!inShadow) {
            // Диффузное освещение
            const diffuse = Math.max(0, normal.dot(lightDir));

            localColor.r += material.color.r * diffuse * light.intensity * light.color.r;
            localColor.g += material.color.g * diffuse * light.intensity * light.color.g;
            localColor.b += material.color.b * diffuse * light.intensity * light.color.b;

            // Спеkулярное освещение (блики)
            const viewDir = rayOrigin.subtract(point).normalize();
            const reflectDir = lightDir.multiply(-1).subtract(normal.multiply(2 * lightDir.multiply(-1).dot(normal))).normalize();
            const specular = Math.pow(Math.max(0, viewDir.dot(reflectDir)), material.shininess);

            localColor.r += material.specular * specular * light.intensity * light.color.r;
            localColor.g += material.specular * specular * light.intensity * light.color.g;
            localColor.b += material.specular * specular * light.intensity * light.color.b;
        }
    }

    // Рекурсивные лучи для отражения и преломления
    let reflectedColor = { r: 0, g: 0, b: 0 };
    let refractedColor = { r: 0, g: 0, b: 0 };

    // Отражение
    if (material.reflection > 0 && depth < FIXED_MAX_DEPTH) {
        const reflectDir = rayDirection.subtract(normal.multiply(2 * rayDirection.dot(normal))).normalize();
        const reflectOrigin = point.add(normal.multiply(0.001));
        reflectedColor = traceRay(reflectOrigin, reflectDir, depth + 1);
    }

    // Преломление (прозрачность)
    if (material.transparency > 0 && depth < FIXED_MAX_DEPTH) {
        const ior = material.refractionIndex;
        const cosi = -rayDirection.dot(normal);
        const etai = 1;
        const etat = ior;

        let n = normal;
        let eta = etai / etat;

        if (cosi < 0) {
            eta = 1 / eta;
            n = normal.multiply(-1);
        }

        const k = 1 - eta * eta * (1 - cosi * cosi);

        if (k >= 0) {
            const refractedDir = rayDirection.multiply(eta).add(n.multiply(eta * cosi - Math.sqrt(k)));
            const refractedOrigin = point.subtract(n.multiply(0.001));
            refractedColor = traceRay(refractedOrigin, refractedDir, depth + 1);
        }
    }

    // Комбинируем цвета
    const reflectionFactor = material.reflection;
    const transparencyFactor = material.transparency;
    const diffuseFactor = 1 - reflectionFactor - transparencyFactor;

    const finalColor = {
        r: localColor.r * diffuseFactor + reflectedColor.r * reflectionFactor + refractedColor.r * transparencyFactor,
        g: localColor.g * diffuseFactor + reflectedColor.g * reflectionFactor + refractedColor.g * transparencyFactor,
        b: localColor.b * diffuseFactor + reflectedColor.b * reflectionFactor + refractedColor.b * transparencyFactor
    };

    // Ограничиваем значения цвета
    finalColor.r = Math.min(1, Math.max(0, finalColor.r));
    finalColor.g = Math.min(1, Math.max(0, finalColor.g));
    finalColor.b = Math.min(1, Math.max(0, finalColor.b));

    return finalColor;
}

function renderScene() {
    const status = document.getElementById('status');
    status.textContent = 'Рендеринг...';

    const startTime = Date.now();
    const aa = FIXED_ANTIALIASING; // Используем фиксированное значение
    const maxDepth = FIXED_MAX_DEPTH; // Используем фиксированное значение
    const width = canvas.width;
    const height = canvas.height;

    // Очистка канваса
    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, 0, width, height);

    // Создаем буфер для данных изображения
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Предварительные вычисления для камеры
    const aspectRatio = width / height;
    const fovRad = camera.fov * Math.PI / 180;
    const scale = Math.tan(fovRad / 2);

    const cameraPos = new Vector3(camera.position.x, camera.position.y, camera.position.z);

    // Простой рендеринг без сложной логики прогресса
    let renderedRows = 0;
    const totalRows = height;
    const updateInterval = Math.max(1, Math.floor(height / 100)); // Обновляем каждые 1%

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let color = { r: 0, g: 0, b: 0 };

            // Антиалиасинг
            for (let dy = 0; dy < aa; dy++) {
                for (let dx = 0; dx < aa; dx++) {
                    const pixelX = x + (dx / aa);
                    const pixelY = y + (dy / aa);

                    // Преобразуем координаты пикселя в координаты сцены
                    const rayX = (2 * pixelX / width - 1) * aspectRatio * scale;
                    const rayY = (1 - 2 * pixelY / height) * scale;

                    // Создаем луч из камеры
                    const rayDirection = new Vector3(rayX, rayY, -1).normalize();

                    // Трассируем луч
                    const pixelColor = traceRay(cameraPos, rayDirection, 0);

                    color.r += pixelColor.r;
                    color.g += pixelColor.g;
                    color.b += pixelColor.b;
                }
            }

            // Усредняем для антиалиасинга
            const samples = aa * aa;
            const index = (y * width + x) * 4;

            data[index] = Math.min(255, Math.floor(color.r / samples * 255));     // R
            data[index + 1] = Math.min(255, Math.floor(color.g / samples * 255)); // G
            data[index + 2] = Math.min(255, Math.floor(color.b / samples * 255)); // B
            data[index + 3] = 255; // Alpha
        }

        renderedRows++;

        // Обновляем прогресс и отображаем частичный результат
        if (y % updateInterval === 0 || y === height - 1) {
            const progress = Math.floor((renderedRows / totalRows) * 100);
            status.textContent = `Рендеринг... ${progress}%`;

            // Показываем текущий прогресс на канвасе
            ctx.putImageData(imageData, 0, 0);
        }
    }

    // Финальный рендеринг
    ctx.putImageData(imageData, 0, 0);

    const renderTime = Date.now() - startTime;
    status.textContent = `Готово! Время рендеринга: ${renderTime}мс`;
}

// ============================================
// Управление материалами
// ============================================
function updateMaterials() {
    const mirrorEnabled = document.getElementById('mirrorEnabled').checked;
    const transparencyEnabled = document.getElementById('transparencyEnabled').checked;

    // Обновляем материалы всех объектов (кроме стен)
    for (const obj of objects) {
        if (obj.type !== 'plane') {
            if (mirrorEnabled) {
                obj.material.reflection = 0.8;
                obj.material.transparency = 0;
            } else if (transparencyEnabled) {
                obj.material.reflection = 0;
                obj.material.transparency = 0.8;
                obj.material.refractionIndex = 1.5;
            } else {
                obj.material.reflection = 0;
                obj.material.transparency = 0;
            }
        }
    }

    renderScene();
}

function updateMirrorWall() {
    const wallType = document.getElementById('mirrorWall').value;

    // Сбрасываем все стены к обычным материалам
    for (const obj of objects) {
        if (obj.type === 'plane') {
            // Определяем, какая это стена
            const normal = obj.normal;
            let isMirrorWall = false;

            if (wallType === 'left' && normal.x > 0.9) isMirrorWall = true;
            if (wallType === 'right' && normal.x < -0.9) isMirrorWall = true;
            if (wallType === 'back' && normal.z > 0.9) isMirrorWall = true;
            if (wallType === 'floor' && normal.y > 0.9) isMirrorWall = true;
            if (wallType === 'ceiling' && normal.y < -0.9) isMirrorWall = true;

            if (isMirrorWall) {
                obj.material.reflection = 0.9;
                obj.material.color = { r: 0.3, g: 0.3, b: 0.3 };
            } else {
                obj.material.reflection = 0;
                // Восстанавливаем оригинальные цвета
                if (normal.x > 0.9) obj.material.color = { r: 0.8, g: 0.1, b: 0.1 }; // Красная
                if (normal.x < -0.9) obj.material.color = { r: 0.1, g: 0.8, b: 0.1 }; // Зеленая
                if (Math.abs(normal.y) > 0.9 || Math.abs(normal.z) > 0.9) {
                    obj.material.color = { r: 0.9, g: 0.9, b: 0.9 }; // Белая
                }
            }
        }
    }

    renderScene();
}

// ============================================
// Управление источниками света
// ============================================
function toggleLight2() {
    const secondLightEnabled = document.getElementById('light2toggle').checked;

    if (!secondLightEnabled) {
        // Удаляем второй источник света
        if (lights.length > 1) {
            lights.pop();
        }
    } else {
        // Добавляем второй источник света
        if (lights.length === 1) {
            const x = parseFloat(document.getElementById('light2X').value);
            const y = parseFloat(document.getElementById('light2Y').value);
            const z = parseFloat(document.getElementById('light2Z').value);

            lights.push({
                position: { x, y, z },
                color: { r: 0.8, g: 0.8, b: 1.0 },
                intensity: 0.7
            });
        }
    }

    renderScene();
}

function updateLight2() {
    if (lights.length > 1) {
        const x = parseFloat(document.getElementById('light2X').value);
        const y = parseFloat(document.getElementById('light2Y').value);
        const z = parseFloat(document.getElementById('light2Z').value);

        lights[1].position = { x, y, z };
        updateSliderValues();

        if (document.getElementById('light2toggle').checked) {
            renderScene();
        }
    }
}

// ============================================
// Экспорт функций в глобальную область видимости
// ============================================
window.initScene = initScene;
window.renderScene = renderScene;
window.updateMaterials = updateMaterials;
window.updateMirrorWall = updateMirrorWall;
window.toggleLight2 = toggleLight2;
window.updateLight2 = updateLight2;

// ============================================
// Инициализация при загрузке
// ============================================
window.onload = function() {
    // Устанавливаем начальное разрешение
    canvas.width = FIXED_RESOLUTION.width;
    canvas.height = FIXED_RESOLUTION.height;

    initScene();
    renderScene();
};
