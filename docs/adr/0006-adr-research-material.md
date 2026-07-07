---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# ADR 調査資料は日付付き不変スナップショットで管理する

## Context and Problem Statement

本リポジトリは tech-slide から editable PPTX 機構を分割したとき、ADR 執筆時の調査根拠として `facts/claims.yaml` を持ち込んだ。だが、この claims はスライド本文が引用する証拠ではない。内容は、Marp / Slidev / PPTX 変換方式、フォント埋め込み、近隣ツールの制約など、スライド開発そのものにまつわる ADR 調査事実である。

この状態では、スライド本文向けの claims 管理と ADR の長尺調査記録が混同される。accepted ADR は本文を不必要に肥大化させずに再検討可能である必要があり、同時に、長尺の調査は後から書き換わらない形でリポジトリに残す必要がある。

## Decision Drivers

* ADR 本文は、決定を再検討できるだけの要点を内包すること。
* 長尺の調査は、取得日時と文脈が固定された記録として残ること。
* 一時メモや作業中の考察を、恒久文書として commit しないこと。
* スライド本文で引用されない開発事実を `facts/claims.yaml` として管理し続けないこと。

## Considered Options

* `claims.yaml` 維持
* ADR 本文へ全埋め込み
* 日付付き research snapshot（three-tier）

## Decision Outcome

Chosen option: "日付付き research snapshot（three-tier）", because ADR の判断に必要な要点は本文に残しつつ、長尺の調査事実を `docs/research/YYYY-MM-DD-topic.md` の不変スナップショットとして保存できるため。`facts/claims.yaml` はスライド本文の証拠ではないので廃止し、既存 8 件の事実は `docs/research/2026-07-07-pptx-approaches.md` の事実表へ移す。

運用規則は次の 3 層とする。

1. **決定に不可欠な要点**は ADR 本文へ埋め込む。ADR 単体で、なぜその選択になったかを再検討できる状態にする。
2. **長尺の調査**は `docs/research/YYYY-MM-DD-topic.md` に日付付き不変スナップショットとして commit し、ADR の `## More Information` からリンクする。後から更新せず、再調査は新しい日付のファイルを作る。
3. **一時メモ**は commit しない。必要なら PR description やセッション成果物に置き、恒久的な根拠にしない。

### Consequences

* Good, because ADR の要点と長尺調査の境界が明確になり、accepted ADR を読みやすい長さに保てる。
* Good, because 旧 `facts/claims.yaml` の statement / value / source_url / as_of / notes は調査スナップショット内の事実表として残る。
* Good, because スライド本文が引用しない開発事実を、claims 管理の対象から外せる。
* Bad, because 調査スナップショットは不変なので、誤りや追加調査が出た場合は新ファイルで差分を残す必要がある。
* Bad, because ADR 本文へ入れる要点と snapshot に逃がす詳細の切り分けは、執筆時の判断に依存する。

### Confirmation

`facts/claims.yaml` は削除する。`docs/adr/*.md` の旧 claim ID 参照は、`docs/research/2026-07-07-pptx-approaches.md` の該当事実または直接の出典 URL への言及へ置き換える。今後 ADR に長尺調査が必要な場合は、日付付き snapshot を作り、ADR の `## More Information` からリンクする。

## Pros and Cons of the Options

### `claims.yaml` 維持

* Good, because 既存の YAML 形式を保てば移行作業が少ない。
* Bad, because スライド本文の証拠ではない開発事実まで claims として扱い、用途が曖昧になる。
* Bad, because ADR の調査スナップショットとしての文脈、取得日、再調査時の不変性を表しにくい。

### ADR 本文へ全埋め込み

* Good, because ADR だけを読めば全ての調査事実に到達できる。
* Bad, because 長尺調査を全て入れると ADR が肥大化し、決定ログとして読まれにくくなる。
* Bad, because raw research と決定の要点が混ざり、accepted ADR の不変性と再調査の扱いが曖昧になる。

### 日付付き research snapshot（three-tier）

* Good, because ADR 本文には決定の要点を残し、長尺調査は日付付き不変ファイルとして保存できる。
* Good, because 再調査は新ファイルになるため、当時の判断材料を後から書き換えない。
* Bad, because ADR と research snapshot の両方を読む場面が増える。

## More Information

* 先行事例: fuj1g0n/skills `docs/adr/0006-manage-adr-research-material.md`（three-tier rule）。
* 調査スナップショット: [docs/research/2026-07-07-pptx-approaches.md](../research/2026-07-07-pptx-approaches.md)。
