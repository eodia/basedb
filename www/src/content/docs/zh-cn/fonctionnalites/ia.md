---
title: 人工智能
description: 字段的 AI 选项、草稿、Copilot 以及仪表盘的 Copilot——还有哪些内容会发送给服务商。
---

AI 是**可选的**。未配置服务商时，不会向任何地方发送任何内容。basedb 可以对接 **OpenAI**、**Anthropic** 和 **Mistral**，使用您自己的密钥，也可以对接任何兼容 OpenAI API 的服务器：**Azure**、企业网关，或部署在您自己环境中的模型。

## 配置服务商

只要界面中还没有保存任何设置，API 就会读取其环境变量：

```bash
BASEDB_AI_PROVIDER=mistral      # openai、anthropic、mistral 或 openai_compatible
BASEDB_AI_MODEL=mistral-small-latest
MISTRAL_API_KEY=…               # 或 BASEDB_AI_API_KEY
```

密钥从 `BASEDB_AI_API_KEY` 读取；如未设置，则从服务商的常用变量名读取（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`MISTRAL_API_KEY`）。

### Azure、网关、本地模型

`BASEDB_AI_PROVIDER=openai_compatible` 会以 OpenAI 的格式，将调用发送到 `BASEDB_AI_BASE_URL` 所指的地址：即 `/chat/completions` 之前的部分，包括参数在内。`BASEDB_AI_HEADERS` 会在每次调用中加入该服务器所要求的标头，格式为 JSON 对象。

```bash
# Azure OpenAI：模型填部署名称，密钥放在 api-key 标头中
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=mon-deploiement
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/v1
BASEDB_AI_HEADERS='{"api-key":"…"}'

# Azure 的旧形式，按部署区分：参数保留在路径之后
BASEDB_AI_BASE_URL=https://ma-ressource.openai.azure.com/openai/deployments/mon-deploiement?api-version=2024-10-21

# 由 Ollama 提供的本地模型，无需密钥
BASEDB_AI_PROVIDER=openai_compatible
BASEDB_AI_MODEL=llama3.1
BASEDB_AI_BASE_URL=http://ollama:11434/v1
```

使用 `openai_compatible` 时，密钥是可选的：如果提供了 `BASEDB_AI_API_KEY`，它会以 `Authorization: Bearer` 的形式发送。`BASEDB_AI_HEADERS` 中的标头会替换由密钥生成的标头——例如，要求使用自己的 `Authorization` 的网关。

`BASEDB_AI_BASE_URL` 和 `BASEDB_AI_HEADERS` 同样适用于通过网关连接的另外三个服务商：对于 `anthropic`，地址是 `/messages` 之前的部分。这两个变量只跟随环境变量中指定的服务商，仅此而已：选择了其他服务商的租户，不会收到地址、标头或密钥。API 启动时会写出所采用的服务商，并在地址或 JSON 对象无效时给出提示。

如果内部网关的 TLS 证书是自签名的，或者企业代理会对流量重新签名，调用就会失败：`BASEDB_AI_PROVIDER_SSL_VERIFY=false` 会停止验证**仅此服务商**的证书——实例的所有其他出站调用，以及租户可能选用的服务商，仍会照常验证。启动时会给出提示。由于密钥会随每次调用一起发送，请仅在您能掌控的网络中使用。

## 字段的 AI 选项

AI 不是一种字段类型，而是一个**选项**：字段表单中的 **AI** 开关——适用于文本、长文本、链接、数字、单选、布尔值、日期——会让模型根据一条引用其他列的指令来填写该字段：

```text
Résume {{Notes}} en une phrase.
Catégorie de {{Description}} parmi les choix de la liste.
```

- 只要行存在，字段就会被计算，之后每当被引用的列发生变化时都会重新计算——如有需要，还可以按计划计算（最频繁每 15 分钟一次）。
- 列**保持其类型**：如果回答中读不出该类型的内容（找不到数字、选项不存在），回答就会被拒绝，而不会被写入。
- 关闭该选项后，字段可再次手动编辑，已有的值会保留。
- 被引用的值会发送给服务商：**启用该选项需要明确同意**。

`BASEDB_AI_FIELD_QUOTA` 限制每个租户每小时的此类计算次数（默认 300）。

## 在自动化中

[自动化](/basedb/zh-cn/fonctionnalites/automatisations/#询问-ai)可以在其某个步骤中**询问 AI**：一条引用该行及前序步骤的指令，得到按所选类型解读的回答，供后续步骤写入、发送或引用。规则与字段相同：保存时需同意，只发送指令中引用的内容，每次调用都会记录日志并计入 `BASEDB_AI_FIELD_QUOTA`。

## 草稿与 Copilot

- **草稿**：用一句话描述一张数据表或一个公式，获得一个待审阅的提议。只会发送显示名称、类型和输入的句子——不包含任何单元格的值。
- **模板**：描述一个完整的数据库——“跟踪客户投诉”——获得数据表、示例行、视图、仪表盘和自动化，可细化后再创建。只会发送这句话。参见[数据库模板](/basedb/zh-cn/fonctionnalites/modeles/#让-ai-生成)。
- **Copilot**：针对当前显示的数据库进行对话。可以请求一个筛选、一个查询、若干列、一张数据表、一组测试数据；每个提议都以卡片形式出现，点击即可应用，所用的接口与表单相同。

默认情况下，只有结构会发送给服务商。勾选**允许读取数据**后，Copilot 可在本次对话中读取行（每次最多 50 行）并据此回答——每次读取都会列在其回答下方。

## 仪表盘的 Copilot

在[仪表盘](/basedb/zh-cn/fonctionnalites/tableaux-de-bord/#copilot)版块中，Copilot 会提议问题、对仪表盘的修改以及筛选的值，点击即可应用。规则相同：未经同意时，只发送结构——数据表和字段、数据库的仪表盘和问题、当前仪表盘的卡片定义（其问题和文本）——从不发送结果或筛选中选定的值。勾选**允许读取数据**后，会额外发送这些值以及当前筛选下卡片的结果，每次读取最多 50 行，每次读取都列在回答下方。

## 自动化的 Copilot

在[自动化](/basedb/zh-cn/fonctionnalites/automatisations/#copilot)版块中，Copilot 会提议一个完整的自动化——修改当前屏幕上的那个，或新建一个——并将其放到编辑器的流程中，**但绝不会保存**：由您检查后再保存。规则相同：未经同意时，只发送结构——数据表和字段、数据库的自动化、当前屏幕上的自动化、其最近的运行记录（不含任何值）、以代号表示的人员和 Slack 频道——勾选**允许读取数据**后，会额外发送读取的行，每次最多 50 行。

`BASEDB_AI_QUOTA` 限制每个租户每小时的交互式调用次数（默认 120）。
