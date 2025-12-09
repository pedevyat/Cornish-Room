// Сцена
const scene = new THREE.Scene();

// Камера
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 5, 10);

// Рендерер
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Элементы управления мышью
let isMouseDown = false;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let currentRotationX = 0, currentRotationY = 0;

// Параметры камеры
let cameraDistance = 15;
let minDistance = 5;
let maxDistance = 30;

// Создание Корнуэльской комнаты (куб)
const roomSize = 20;
const roomGeometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize);

// ИСХОДНЫЕ материалы для стен
const originalWallMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xff4444, side: THREE.BackSide, roughness: 0.8, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x44ff44, side: THREE.BackSide, roughness: 0.8, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x4444ff, side: THREE.BackSide, roughness: 0.8, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0xffff44, side: THREE.BackSide, roughness: 0.8, metalness: 0 }), // ПОЛ
    new THREE.MeshStandardMaterial({ color: 0xff44ff, side: THREE.BackSide, roughness: 0.8, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x44ffff, side: THREE.BackSide, roughness: 0.8, metalness: 0 })
];

const room = new THREE.Mesh(roomGeometry, originalWallMaterials.slice()); // Используем копию
scene.add(room);

// Объекты сцены
const objects = [];


// Куб (обязательный)
const cubeGeometry = new THREE.BoxGeometry(4, 4, 4); // Было (2, 2, 2) - увеличили в 2 раза
const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    roughness: 0.5,
    metalness: 0
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(-6, -roomSize/2 + 2, 0); // Y = -10 + 2 (половина высоты увеличенного куба)
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);
objects.push({ mesh: cube, type: 'cube', id: 1 });

// Куб (дополнительный)
const cube2Geometry = new THREE.BoxGeometry(3, 6, 3); // Было (2, 4, 2)
const cube2Material = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    roughness: 0.5,
    metalness: 0
});
const cube2 = new THREE.Mesh(cube2Geometry, cube2Material);
cube2.position.set(6, -roomSize/2 + 3, 0); // Y = -10 + 3 (половина высоты увеличенного куба)
cube2.castShadow = true;
cube2.receiveShadow = true;
scene.add(cube2);
objects.push({ mesh: cube2, type: 'cube', id: 2 });

// Шар
const sphereGeometry = new THREE.SphereGeometry(3, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    roughness: 0.5,
    metalness: 0
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(0, -roomSize/2 + 3, -5); // Y = -10 + 3 (радиус увеличенного шара)
sphere.castShadow = true;
sphere.receiveShadow = true;
scene.add(sphere);
objects.push({ mesh: sphere, type: 'sphere', id: 3 });

// Основной источник света
const light1 = new THREE.PointLight(0xffffff, 0.8, 50);
light1.position.set(0, 5, 0);
light1.castShadow = true;
light1.shadow.mapSize.width = 1024;
light1.shadow.mapSize.height = 1024;
scene.add(light1);

// Второй источник света
const light2 = new THREE.PointLight(0xffaa00, 0.6, 30);
light2.position.set(5, 3, 0);
light2.castShadow = true;
scene.add(light2);

// Обновление материалов объектов
function updateMaterial(id) {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;

    const mirror = document.getElementById(`mirror${id}`).checked;
    const transparent = document.getElementById(`transparent${id}`).checked;

    let roughness = mirror ? 0.1 : 0.5;
    let metalness = mirror ? 0.9 : 0;
    let opacity = transparent ? 0.6 : 1;
    let transparentMaterial = transparent;

    obj.mesh.material = new THREE.MeshStandardMaterial({
        color: obj.mesh.material.color,
        roughness: roughness,
        metalness: metalness,
        opacity: opacity,
        transparent: transparentMaterial
    });
}

// функция обновления зеркальной стены
function updateMirrorWall() {
    const wall = document.getElementById('mirrorWall').value;

    // Восстановление ВСЕХ стен к исходным материалам
    for (let i = 0; i < 6; i++) {
        room.material[i] = originalWallMaterials[i].clone();
    }

    // Применение зеркальности к выбранной стене
    if (wall !== 'none') {
        let wallIndex;
        switch(wall) {
            case 'left': wallIndex = 0; break;
            case 'right': wallIndex = 1; break;
            case 'ceiling': wallIndex = 2; break;
            case 'floor': wallIndex = 3; break;
            case 'front': wallIndex = 4; break;
            case 'back': wallIndex = 5; break;
        }

        room.material[wallIndex] = new THREE.MeshStandardMaterial({
            color: 0x888888,
            side: THREE.BackSide,
            roughness: 0.1,
            metalness: 0.9
        });
    }

    room.material.needsUpdate = true;
}

// Управление вторым источником света
function toggleLight2() {
    const enabled = document.getElementById('light2toggle').checked;
    light2.visible = enabled;
}

function updateLight2() {
    const x = parseFloat(document.getElementById('light2X').value);
    const y = parseFloat(document.getElementById('light2Y').value);
    const z = parseFloat(document.getElementById('light2Z').value);

    light2.position.set(x, y, z);
}

// Обработчики мыши
document.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
});

document.addEventListener('mouseup', () => {
    isMouseDown = false;
});

document.addEventListener('mousemove', (event) => {
    if (!isMouseDown) return;

    const deltaX = event.clientX - mouseX;
    const deltaY = event.clientY - mouseY;

    targetRotationY += deltaX * 0.01;
    targetRotationX += deltaY * 0.01;

    targetRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, targetRotationX));

    mouseX = event.clientX;
    mouseY = event.clientY;
});

document.addEventListener('wheel', (event) => {
    event.preventDefault();

    cameraDistance += event.deltaY * 0.001 * cameraDistance;
    cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
}, { passive: false });

// Функция обновления позиции камеры
function updateCameraPosition() {
    camera.position.x = cameraDistance * Math.sin(currentRotationY) * Math.cos(currentRotationX);
    camera.position.y = cameraDistance * Math.sin(currentRotationX);
    camera.position.z = cameraDistance * Math.cos(currentRotationY) * Math.cos(currentRotationX);

    camera.lookAt(0, 0, 0);
}

// Анимация
function animate() {
    requestAnimationFrame(animate);

    currentRotationX += (targetRotationX - currentRotationX) * 0.05;
    currentRotationY += (targetRotationY - currentRotationY) * 0.05;

    updateCameraPosition();

    // Вращение
    cube.rotation.y += 0.01;
    cube2.rotation.x += 0.01;
    sphere.rotation.y += 0.01;

    renderer.render(scene, camera);
}

// Обработка изменения размера окна
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Запуск
animate();
