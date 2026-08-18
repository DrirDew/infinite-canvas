import { deleteUserRecords, ensureQuotaDay, findUserById, findUserByUsername, insertUser, listUsers, setPasswordHash, setUserQuotas, shanghaiDate, withImmediate } from "./db";
import { removeUserGenerations } from "./generations";
import { toPublicUser, type UserRole } from "./schema";

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{2,32}$/;

export function normalizeUsername(value: unknown) {
    return String(value || "").trim();
}

export function validateUsername(username: string) {
    if (!USERNAME_PATTERN.test(username)) throw new Error("用户名需为 2-32 位字母、数字、点、下划线或短横线");
}

export function validatePassword(password: string) {
    if (password.length < 6) throw new Error("密码至少 6 位");
}

export async function createUser(username: string, password: string, role: UserRole = "user") {
    const name = normalizeUsername(username);
    validateUsername(name);
    validatePassword(password);
    if (findUserByUsername(name)) throw new Error("用户名已存在");
    const row = {
        id: crypto.randomUUID(),
        username: name,
        password_hash: await Bun.password.hash(password),
        role,
        image_quota: 0,
        video_quota: 0,
        image_used: 0,
        video_used: 0,
        quota_date: shanghaiDate(),
        created_at: Date.now(),
    };
    insertUser(row);
    return toPublicUser(row);
}

export function publicUsers() {
    return listUsers().flatMap((row) => {
        const fresh = ensureQuotaDay(row.id);
        return fresh ? [toPublicUser(fresh)] : [];
    });
}

export async function changeUserPassword(actorId: string, targetId: string, currentPassword: string, newPassword: string) {
    validatePassword(newPassword);
    const actor = findUserById(actorId);
    if (!actor) throw new Error("用户不存在");
    if (!(await Bun.password.verify(currentPassword, actor.password_hash))) throw new Error("原密码错误");
    const target = findUserById(targetId);
    if (!target) throw new Error("用户不存在");
    setPasswordHash(targetId, await Bun.password.hash(newPassword));
}

export function removeUser(id: string) {
    const row = findUserById(id);
    if (!row) throw new Error("用户不存在");
    if (row.role === "admin") throw new Error("管理员账号不能删除");
    withImmediate(() => deleteUserRecords(id));
    removeUserGenerations(id);
}

function parseQuota(value: unknown) {
    const next = Math.floor(Number(value));
    if (!Number.isInteger(next) || next < 0) throw new Error("额度必须是大于等于 0 的整数");
    return next;
}

export function adjustQuotas(userId: string, imageQuota?: unknown, videoQuota?: unknown) {
    const row = ensureQuotaDay(userId);
    if (!row) throw new Error("用户不存在");
    const nextImage = imageQuota === undefined ? row.image_quota : parseQuota(imageQuota);
    const nextVideo = videoQuota === undefined ? row.video_quota : parseQuota(videoQuota);
    setUserQuotas(userId, nextImage, nextVideo);
    return toPublicUser({ ...row, image_quota: nextImage, video_quota: nextVideo });
}
