"use strict";

const receiptPhotoItems = [];
window.receiptPhotoItems = receiptPhotoItems;
const cropDialog = element("receipt-crop-dialog");
const cropCanvas = element("receipt-crop-canvas");
const cropContext = cropCanvas.getContext("2d");
let activeCropItem = null;
let activeCropBitmap = null;
let activeCrop = null;
let cropPointer = null;

function clampCrop(value, minimum, maximum)
{
    return Math.min(maximum, Math.max(minimum, value));
}

function normalizedCrop(crop)
{
    const x = clampCrop(crop.x, 0, 0.94);
    const y = clampCrop(crop.y, 0, 0.94);
    const right = clampCrop(crop.x + crop.width, x + 0.06, 1);
    const bottom = clampCrop(crop.y + crop.height, y + 0.06, 1);
    return {x, y, width : right - x, height : bottom - y};
}

function paintCropPreview()
{
    if (!activeCropBitmap) return;
    const ratio = Math.min(1000 / activeCropBitmap.width, 1250 / activeCropBitmap.height, 1);
    cropCanvas.width = Math.max(1, Math.round(activeCropBitmap.width * ratio));
    cropCanvas.height = Math.max(1, Math.round(activeCropBitmap.height * ratio));
    cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropContext.drawImage(activeCropBitmap, 0, 0, cropCanvas.width, cropCanvas.height);
    const x = activeCrop.x * cropCanvas.width;
    const y = activeCrop.y * cropCanvas.height;
    const right = (activeCrop.x + activeCrop.width) * cropCanvas.width;
    const bottom = (activeCrop.y + activeCrop.height) * cropCanvas.height;
    cropContext.fillStyle = "rgba(5, 15, 10, .56)";
    cropContext.fillRect(0, 0, cropCanvas.width, y);
    cropContext.fillRect(0, bottom, cropCanvas.width, cropCanvas.height - bottom);
    cropContext.fillRect(0, y, x, bottom - y);
    cropContext.fillRect(right, y, cropCanvas.width - right, bottom - y);
    cropContext.strokeStyle = "#f5fff2";
    cropContext.lineWidth = Math.max(2, cropCanvas.width / 450);
    cropContext.strokeRect(x, y, right - x, bottom - y);
    const handle = Math.max(10, cropCanvas.width / 35);
    for (const [hx, hy] of [[x, y], [right, y], [x, bottom], [right, bottom]])
    {
        cropContext.beginPath();
        cropContext.arc(hx, hy, handle, 0, Math.PI * 2);
        cropContext.fillStyle = "#ffffff";
        cropContext.fill();
        cropContext.strokeStyle = "#28694c";
        cropContext.lineWidth = 3;
        cropContext.stroke();
    }
}

async function openReceiptCrop(item)
{
    activeCropItem = item;
    try
    {
        activeCropBitmap = await createImageBitmap(item.file);
        activeCrop = normalizedCrop(item.crop || {x : 0.02, y : 0.02, width : 0.96, height : 0.96});
        paintCropPreview();
        cropDialog.showModal();
    }
    catch (error)
    {
        activeCropItem = null;
        element("receipt-send-status").textContent = "Dieses Bild kann nicht geöffnet werden. Bitte ein anderes Foto auswählen.";
    }
}

function closeReceiptCrop()
{
    if (cropDialog.open) cropDialog.close();
    if (activeCropBitmap) activeCropBitmap.close();
    activeCropBitmap = null;
    activeCropItem = null;
    activeCrop = null;
    cropPointer = null;
}

function renderReceiptPhotos()
{
    const target = element("receipt-photo-list");
    target.querySelectorAll("img[data-object-url]").forEach((image) => URL.revokeObjectURL(image.dataset.objectUrl));
    target.replaceChildren();
    receiptPhotoItems.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "receipt-photo-row";
        const preview = document.createElement("div");
        preview.className = "receipt-photo-preview";
        const image = document.createElement("img");
        image.src = URL.createObjectURL(item.file);
        image.dataset.objectUrl = image.src;
        image.alt = `Seite ${index + 1}`;
        const details = document.createElement("span");
        details.textContent = `${index + 1}. ${item.file.name}${item.crop ? " · Zuschnitt gesetzt" : " · ganzes Foto"}`;
        preview.append(image, details);
        const actions = document.createElement("div");
        actions.className = "receipt-photo-actions";
        const crop = document.createElement("button");
        crop.type = "button";
        crop.textContent = item.crop ? "Zuschnitt ändern" : "Zuschneiden";
        crop.addEventListener("click", () => openReceiptCrop(item));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Entfernen";
        remove.addEventListener("click", () => {
            URL.revokeObjectURL(image.dataset.objectUrl);
            receiptPhotoItems.splice(index, 1);
            renderReceiptPhotos();
        });
        actions.append(crop, remove);
        row.append(preview, actions);
        target.append(row);
    });
}

element("receipt-photo-input").addEventListener("change", (event) => {
    for (const file of event.target.files || [])
    {
        if (file.type.startsWith("image/")) receiptPhotoItems.push({file, crop : null});
    }
    event.target.value = "";
    renderReceiptPhotos();
});

function pointerPosition(event)
{
    const bounds = cropCanvas.getBoundingClientRect();
    return {x : (event.clientX - bounds.left) / bounds.width,
            y : (event.clientY - bounds.top) / bounds.height};
}

cropCanvas.addEventListener("pointerdown", (event) => {
    if (!activeCrop) return;
    const point = pointerPosition(event);
    const corners = [
        {name : "nw", x : activeCrop.x, y : activeCrop.y},
        {name : "ne", x : activeCrop.x + activeCrop.width, y : activeCrop.y},
        {name : "sw", x : activeCrop.x, y : activeCrop.y + activeCrop.height},
        {name : "se", x : activeCrop.x + activeCrop.width, y : activeCrop.y + activeCrop.height}
    ];
    const nearest = corners.map((corner) => ({...corner, distance : Math.hypot(point.x - corner.x, point.y - corner.y)}))
        .sort((a, b) => a.distance - b.distance)[0];
    const inside = point.x >= activeCrop.x && point.x <= activeCrop.x + activeCrop.width &&
        point.y >= activeCrop.y && point.y <= activeCrop.y + activeCrop.height;
    cropPointer = {mode : nearest.distance <= 0.065 ? nearest.name : (inside ? "move" : "se"),
                   start : point, original : {...activeCrop}};
    cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas.addEventListener("pointermove", (event) => {
    if (!cropPointer) return;
    const point = pointerPosition(event);
    const dx = point.x - cropPointer.start.x;
    const dy = point.y - cropPointer.start.y;
    const original = cropPointer.original;
    let left = original.x, top = original.y;
    let right = original.x + original.width, bottom = original.y + original.height;
    if (cropPointer.mode === "move")
    {
        left = clampCrop(original.x + dx, 0, 1 - original.width);
        top = clampCrop(original.y + dy, 0, 1 - original.height);
        right = left + original.width;
        bottom = top + original.height;
    }
    else
    {
        if (cropPointer.mode.includes("w")) left = clampCrop(original.x + dx, 0, right - 0.06);
        if (cropPointer.mode.includes("e")) right = clampCrop(original.x + original.width + dx, left + 0.06, 1);
        if (cropPointer.mode.includes("n")) top = clampCrop(original.y + dy, 0, bottom - 0.06);
        if (cropPointer.mode.includes("s")) bottom = clampCrop(original.y + original.height + dy, top + 0.06, 1);
    }
    activeCrop = {x : left, y : top, width : right - left, height : bottom - top};
    paintCropPreview();
});
cropCanvas.addEventListener("pointerup", () => { cropPointer = null; });
cropCanvas.addEventListener("pointercancel", () => { cropPointer = null; });

element("receipt-crop-reset").addEventListener("click", () => {
    activeCrop = {x : 0, y : 0, width : 1, height : 1};
    paintCropPreview();
});
element("receipt-crop-apply").addEventListener("click", () => {
    if (activeCropItem) activeCropItem.crop = normalizedCrop(activeCrop);
    closeReceiptCrop();
    renderReceiptPhotos();
});
for (const button of [element("receipt-crop-cancel"), element("receipt-crop-cancel-top")])
{
    button.addEventListener("click", closeReceiptCrop);
}
cropDialog.addEventListener("click", (event) => {
    if (event.target === cropDialog) closeReceiptCrop();
});

window.prepareReceiptA4 = async function(item)
{
    const bitmap = await createImageBitmap(item.file);
    try
    {
        const crop = normalizedCrop(item.crop || {x : 0, y : 0, width : 1, height : 1});
        const sx = crop.x * bitmap.width;
        const sy = crop.y * bitmap.height;
        const sw = crop.width * bitmap.width;
        const sh = crop.height * bitmap.height;
        const canvas = document.createElement("canvas");
        canvas.width = 2480;
        canvas.height = 3508;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const margin = 80;
        const scale = Math.min((canvas.width - margin * 2) / sw, (canvas.height - margin * 2) / sh);
        const width = sw * scale;
        const height = sh * scale;
        context.drawImage(bitmap, sx, sy, sw, sh,
                          (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        return await new Promise((resolve, reject) =>
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Die A4-Seite konnte nicht erstellt werden.")), "image/jpeg", 0.9));
    }
    finally
    {
        bitmap.close();
    }
};
