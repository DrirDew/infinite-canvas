# 阿里云镜像站

本机构建，推到阿里云个人版容器镜像服务，服务器只拉取、不编译。本地镜像名是 `infinite-canvas:local`（见 `docker-compose.local.yml`）。

先在 [容器镜像服务控制台](https://cr.console.aliyun.com/) 确认命名空间 `drir` 下已有仓库 `infinite-canvas`（没有就新建，或打开自动创建仓库）。访问凭证在控制台「访问凭证」里设置，登录用户名是阿里云账号（手机号或邮箱）。

下面命令里的 `IMAGE_TAG` 自行改成这次版本，例如 `20260817`。不要把密码写进仓库。

## 变量

```bash
REGISTRY=crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com
NAMESPACE=drir
IMAGE=infinite-canvas
LOCAL=infinite-canvas:local
IMAGE_TAG=20260817
REMOTE=$REGISTRY/$NAMESPACE/$IMAGE:$IMAGE_TAG
```

## 本机：构建并推送

在仓库根目录执行。Windows 用 PowerShell 那一段。

### PowerShell

```powershell
$REGISTRY = "crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com"
$NAMESPACE = "drir"
$IMAGE = "infinite-canvas"
$LOCAL = "infinite-canvas:local"
$IMAGE_TAG = "20260817"
$REMOTE = "$REGISTRY/$NAMESPACE/${IMAGE}:$IMAGE_TAG"

docker compose -f docker-compose.local.yml build
docker login --username=你的阿里云账号 $REGISTRY
docker tag $LOCAL $REMOTE
docker push $REMOTE
```

### Bash

```bash
REGISTRY=crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com
NAMESPACE=drir
IMAGE=infinite-canvas
LOCAL=infinite-canvas:local
IMAGE_TAG=20260817
REMOTE=$REGISTRY/$NAMESPACE/$IMAGE:$IMAGE_TAG

docker compose -f docker-compose.local.yml build
docker login --username=你的阿里云账号 "$REGISTRY"
docker tag "$LOCAL" "$REMOTE"
docker push "$REMOTE"
```

`build` 只在本机跑。推送成功后记下这次的 `IMAGE_TAG`。

## 服务器：拉取并启动

服务器不要加 `--build`，否则又会在服务器上编译。仓库和 `.env`（`AUTH_USER` / `AUTH_PASSWORD`）要先放到服务器上。

```bash
REGISTRY=crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com
NAMESPACE=drir
IMAGE=infinite-canvas
LOCAL=infinite-canvas:local
IMAGE_TAG=20260817
REMOTE=$REGISTRY/$NAMESPACE/$IMAGE:$IMAGE_TAG

docker login --username=你的阿里云账号 "$REGISTRY"
docker pull "$REMOTE"
docker tag "$REMOTE" "$LOCAL"
docker compose -f docker-compose.local.yml up -d
```

更新已有部署时，改 `IMAGE_TAG` 后再执行上面四条（login 已登录可省略），最后仍用 `up -d`，不要 `--build`。

访问 `http://服务器IP:3000`。若设置了 `AUTH_PASSWORD`，浏览器会弹出登录框。

## 对照

| 本机 | 镜像站 |
| --- | --- |
| `infinite-canvas:local` | `crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com/drir/infinite-canvas:<IMAGE_TAG>` |



## 快速

本机：

```powershell
$REGISTRY = "crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com"
$NAMESPACE = "drir"
$IMAGE = "infinite-canvas"
$LOCAL = "infinite-canvas:local"
$IMAGE_TAG = "latest"
$REMOTE = "$REGISTRY/$NAMESPACE/${IMAGE}:$IMAGE_TAG"

docker compose -f docker-compose.local.yml build
docker tag $LOCAL $REMOTE
docker push $REMOTE
```

服务器

```bash
REGISTRY=crpi-e9lbf8hhoxeu7sfj.cn-hangzhou.personal.cr.aliyuncs.com
NAMESPACE=drir
IMAGE=infinite-canvas
LOCAL=infinite-canvas:local
IMAGE_TAG=latest
REMOTE=$REGISTRY/$NAMESPACE/$IMAGE:$IMAGE_TAG

docker pull "$REMOTE"
docker tag "$REMOTE" "$LOCAL"
docker compose -f docker-compose.local.yml up -d
```