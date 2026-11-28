import { useState } from "react";
import type { SkinId } from "../game/types";
import { CURIOUS_SKINS, FORM_INFO, formDesc, formLabel, getSkin, NEW_SKINS, SKINS, skinCollectionLabel, skinName, type Skin } from "../game/skins";
import { useT } from "../i18n/useT";
import { fmt } from "../i18n";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audio";
import { SnakePreview } from "./SnakePreview";
import { Icon } from "./Icon";
import { ModalHeader, Overlay, Tabs } from "./uiKit";
import { SkinTrial } from "./SkinTrial";

export function Closet() {
  const open = useGameStore((s) => s.closetOpen);
  const selection = useGameStore((s) => s.closetSelection);
  const equipped = useGameStore((s) => s.equipped);
  return open ? <Workshop initial={selection ?? equipped} /> : null;
}

function Workshop({ initial }: { initial: SkinId }) {
  const t = useT();
  const [previewId, setPreviewId] = useState(initial);
  const [filter, setFilter] = useState(getSkin(initial).collection === "curious-objects" ? "curious" : getSkin(initial).collection ? "new" : "all");
  const [query, setQuery] = useState("");
  const [trying, setTrying] = useState(false);
  const coins = useGameStore((s) => s.coins);
  const owned = useGameStore((s) => s.owned);
  const equipped = useGameStore((s) => s.equipped);
  const close = useGameStore((s) => s.setClosetOpen);
  const buy = useGameStore((s) => s.buySkin);
  const equip = useGameStore((s) => s.equipSkin);
  const skin = getSkin(previewId);
  const isOwned = owned.includes(previewId);
  const isEquipped = equipped === previewId;
  const filtered = SKINS.filter((s) => (filter !== "new" || s.collection === "paper-objects") && (filter !== "curious" || s.collection === "curious-objects") && (filter !== "owned" || owned.includes(s.id)) && `${s.name} ${s.englishName ?? ""} ${FORM_INFO[s.form].label} ${formLabel(s.form)}`.toLowerCase().includes(query.toLowerCase()));

  const useSkin = () => {
    audio.ui();
    if (!isOwned) { if (buy(previewId)) audio.reward(); return; }
    equip(previewId); useGameStore.getState().notify(t("已装备 {name}", { name: skinName(skin) }));
  };

  return (
    <Overlay onClose={() => close(false)} className="atelier-dialog">
      <ModalHeader eyebrow={trying ? "A LITTLE TEST SWIM" : "THE SKIN ATELIER"} title={trying ? t("造型试游 · {name}", { name: skinName(skin) }) : t("皮肤工坊")} subtitle={trying ? t("先游一圈再决定。未解锁的造型也可以试。") : t("不只是换个颜色，是换一种想象。")} onClose={() => close(false)} right={<span className="wallet-link"><Icon name="coin" />{fmt(coins)}</span>} />
      {trying ? <SkinTrial skin={previewId} onBack={() => setTrying(false)} /> : <div className="atelier-body">
        <section className="atelier-preview" aria-label={t("所选皮肤详情")}>
          <div className="atelier-stage"><SnakePreview skin={previewId} width={420} height={470} pose="portrait" animated orbs={false} /></div>
          <div className="atelier-details" key={previewId}>
            <span className="collection-label">{skinCollectionLabel(skin)} / {formLabel(skin.form)}</span>
            <h3>{skinName(skin)}<small>{skin.englishName && skinName(skin) !== skin.englishName ? skin.englishName : t(skin.tagline)}</small></h3>
            <p>{formDesc(skin.form)}</p>
            <span className="skin-rule"><Icon name="shield" />{t("只改变外观，不改变速度与碰撞范围")}</span>
            <button type="button" className="play-button" onClick={useSkin} disabled={isEquipped}>
              <span>{isEquipped ? t("当前已装备") : isOwned ? t("使用这个造型") : t("解锁造型 · {price} 金币", { price: skin.price })}</span><Icon name={isEquipped ? "check" : isOwned ? "arrow" : "lock"} />
            </button>
            <button type="button" className="atelier-try-link" onClick={() => { audio.ui(); setTrying(true); }}><Icon name="play" /><span>{t("先试游 20 秒")}</span><small>{t("不消耗金币")}</small><Icon name="arrow" /></button>
          </div>
        </section>
        <section className="atelier-collection" aria-label={t("全部皮肤")}>
          <div className="atelier-toolbar">
            <Tabs value={filter} onChange={setFilter} items={[{ id: "curious", label: t("异想 {n}", { n: CURIOUS_SKINS.length }) }, { id: "new", label: t("纸上 {n}", { n: NEW_SKINS.length }) }, { id: "all", label: t("全部 {n}", { n: SKINS.length }) }, { id: "owned", label: t("已拥有 {n}", { n: owned.length }) }]} />
            <label className="atelier-search"><input placeholder=" " aria-label={t("搜索皮肤")} value={query} onChange={(e) => setQuery(e.target.value)} /><Icon name="search" /></label>
          </div>
          <div className="atelier-grid">
            {filtered.map((item) => <SkinTile key={item.id} skin={item} selected={previewId === item.id} owned={owned.includes(item.id)} equipped={equipped === item.id} onSelect={() => setPreviewId(item.id)} />)}
            {!filtered.length && <p className="atelier-empty">{t("还没有找到这个造型，换个关键词试试。")}</p>}
          </div>
          <div className="atelier-count">{t("已收集 {a} / {b} 款 · 所有造型均可通过游玩解锁", { a: owned.length, b: SKINS.length })}</div>
        </section>
      </div>}
    </Overlay>
  );
}

function SkinTile({ skin, selected, owned, equipped, onSelect }: { skin: Skin; selected: boolean; owned: boolean; equipped: boolean; onSelect: () => void }) {
  const t = useT();
  return <button type="button" className={`atelier-tile ${selected ? "is-selected" : ""}`} onClick={onSelect} aria-pressed={selected} aria-label={t("预览{name}", { name: skinName(skin) })}>
    {equipped && <Icon name="check" className="tile-check" />}
    <div className="tile-art"><SnakePreview skin={skin.id} width={152} height={80} orbs={false} /></div>
    <h4>{skinName(skin)}</h4>
    <div className="tile-meta"><span>{formLabel(skin.form)}</span><span>{owned ? t("已拥有") : <><Icon name="coin" />{skin.price}</>}</span></div>
  </button>;
}