'use client';
import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  catalog,
  cosmeticFinish,
  cosmeticSlot,
  type Cosmetic,
} from '@/lib/catalog';
import { weapons, weaponIds, type WeaponId } from '@/lib/fps/simulation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { WeaponPreview } from './arena-menu';

import './cosmetic-shop.css';

type Props = {
  inventory: boolean;
  owned: Set<string>;
  equipped: Set<string>;
  busy: boolean;
  signedIn: boolean;
  act: (body: Record<string, unknown>, message: string) => Promise<void>;
};
export default function CosmeticShop({
  inventory,
  owned,
  equipped,
  busy,
  signedIn,
  act,
}: Props) {
  const [filter, setFilter] = useState('all'),
    [inspected, setInspected] = useState<Cosmetic | null>(null),
    [weapon, setWeapon] = useState<WeaponId>('rifle'),
    [angle, setAngle] = useState(0),
    [buyIntent, setBuyIntent] = useState(false);
  const dragRef = useRef({ active: false, x: 0 });
  const isKnife = (item: Cosmetic) => cosmeticSlot(item) === 'knife';
  const unlocked = (item: Cosmetic) => owned.has(item.sku);
  const items = catalog.filter(
    (item) =>
      (!inventory || unlocked(item)) &&
      (filter === 'all' ||
        (filter === 'knives' && isKnife(item)) ||
        (filter === 'animated' && 'effect' in item) ||
        (filter === 'standard' && !isKnife(item) && !('effect' in item))),
  );
  function openItem(item: Cosmetic, buying = false) {
    setInspected(item);
    setBuyIntent(buying && !unlocked(item));
    setAngle(0);
  }
  function inspectFromKey(e: KeyboardEvent<HTMLElement>, item: Cosmetic) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openItem(item);
  }
  function stopCardOpen(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
  }
  async function confirmBuy(item: Cosmetic) {
    await act(
      { action: 'shop_buy', sku: item.sku },
      item.price === 0 ? item.name + ' claimed.' : item.name + ' unlocked.',
    );
    setBuyIntent(false);
  }
  function startRotate(e: PointerEvent<HTMLDivElement>) {
    dragRef.current = { active: true, x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function rotatePreview(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    dragRef.current.x = e.clientX;
    setAngle((value) => Math.max(-1.8, Math.min(1.8, value + dx * 0.012)));
  }
  function stopRotate(e: PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function action(item: Cosmetic, inInspector = false) {
    const selected = equipped.has(item.sku),
      knife = isKnife(item);
    if (!unlocked(item))
      return (
        <button
          className="primary compact"
          disabled={busy || !signedIn}
          onClick={(e) => {
            stopCardOpen(e);
            if (inInspector && buyIntent) void confirmBuy(item);
            else openItem(item, true);
          }}
        >
          {item.price === 0
            ? inInspector && buyIntent
              ? 'Confirm claim'
              : 'Claim free'
            : `${inInspector && buyIntent ? 'Confirm buy' : 'Buy'} €${(item.price / 100).toFixed(2)}`}
        </button>
      );
    if (!signedIn)
      return (
        <a className="secondary compact" href="/signin" onClick={stopCardOpen}>
          Sign in to equip
        </a>
      );
    return (
      <button
        className="secondary compact"
        disabled={busy || !signedIn}
        onClick={(e) => {
          stopCardOpen(e);
          void act(
            {
              action: 'inventory_equip',
              sku: selected ? '' : item.sku,
              slot: cosmeticSlot(item),
            },
            selected
              ? knife
                ? 'Combat knife equipped.'
                : 'Black standard finish equipped.'
              : item.name + ' equipped for your next match.',
          );
        }}
      >
        {selected
          ? knife
            ? 'Use combat knife'
            : 'Unequip'
          : knife
            ? 'Equip knife'
            : 'Equip finish'}
      </button>
    );
  }
  return (
    <>
      <div className="armory-toolbar">
        <div className="armory-tabs" role="group" aria-label="Shop category">
          {[
            ['all', 'All items'],
            ['knives', 'Knives'],
            ['animated', 'Animated'],
            ['standard', 'Standard'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
            >
              {id === 'animated' && <Sparkles size={15} />} {label}
            </button>
          ))}
        </div>
        <div className="armory-actions">
          <a
            className="secondary compact inventory-shortcut"
            href={inventory ? '/shop' : '/inventory'}
          >
            {inventory ? 'Browse shop' : 'Your inventory'}
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
      <p className="armory-caption">
        Buy a finish or knife, then equip it for your next match. Cosmetics
        never change weapon damage.
      </p>
      <div className="cosmetic-grid">
        {items.map((item, index) => (
          <article
            className={
              'account-panel cosmetic-card' +
              ('effect' in item ? ' animated-cosmetic' : '') +
              (isKnife(item) ? ' knife-cosmetic' : '')
            }
            key={item.sku}
            tabIndex={0}
            aria-label={'Inspect ' + item.name}
            onClick={() => openItem(item)}
            onKeyDown={(e) => inspectFromKey(e, item)}
            style={
              {
                '--wrap': item.color,
                '--item-index': index,
              } as React.CSSProperties
            }
          >
            <div className="weapon-preview cosmetic-inspect">
              <WeaponPreview
                id={isKnife(item) ? 'knife' : 'rifle'}
                skin={cosmeticFinish(item)}
                knifeStyle={isKnife(item) ? 'karambit' : 'standard'}
              />
            </div>
            <span className="eyebrow">{item.kind}</span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="cosmetic-footer">
              <div>
                <strong>
                  {equipped.has(item.sku)
                    ? 'Equipped'
                    : unlocked(item)
                      ? 'Owned'
                      : item.price === 0
                        ? 'Free'
                        : '€' + (item.price / 100).toFixed(2)}
                </strong>
              </div>
              {action(item)}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="account-panel platform-empty">
          <h2>
            {inventory
              ? 'No owned items in this collection yet'
              : 'No items in this category'}
          </h2>
          <p>
            {inventory
              ? 'Find your next knife in the shop.'
              : 'Choose another category.'}
          </p>
          {inventory && (
            <a className="secondary compact" href="/shop">
              Browse shop
              <ArrowRight size={15} />
            </a>
          )}
        </div>
      )}
      <Dialog
        open={!!inspected}
        onOpenChange={(open) => {
          if (!open) {
            setInspected(null);
            setBuyIntent(false);
          }
        }}
      >
        <DialogContent className="sc-dialog finish-inspector">
          {inspected && (
            <>
              <span className="eyebrow">{inspected.kind}</span>
              <DialogTitle>{inspected.name}</DialogTitle>
              <DialogDescription>{inspected.description}</DialogDescription>
              <div
                className="inspect-stage"
                style={{ '--wrap': inspected.color } as React.CSSProperties}
                onPointerDown={startRotate}
                onPointerMove={rotatePreview}
                onPointerUp={stopRotate}
                onPointerCancel={stopRotate}
                role="slider"
                tabIndex={0}
                aria-label={`Rotate ${isKnife(inspected) ? 'knife' : 'weapon'} preview`}
                aria-valuemin={-180}
                aria-valuemax={180}
                aria-valuenow={Math.round(angle * 100)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft')
                    setAngle((value) => Math.max(-1.8, value - 0.15));
                  if (e.key === 'ArrowRight')
                    setAngle((value) => Math.min(1.8, value + 0.15));
                }}
              >
                <WeaponPreview
                  id={isKnife(inspected) ? 'knife' : weapon}
                  skin={cosmeticFinish(inspected)}
                  knifeStyle={isKnife(inspected) ? 'karambit' : 'standard'}
                  angle={angle}
                />
              </div>
              {!isKnife(inspected) && (
                <div
                  className="inspect-weapons"
                  role="group"
                  aria-label="Choose weapon model"
                >
                  {weaponIds.map((id) => (
                    <button
                      key={id}
                      aria-pressed={weapon === id}
                      onClick={() => setWeapon(id)}
                    >
                      {weapons[id].name}
                    </button>
                  ))}
                </div>
              )}
              <div className="inspect-footer">
                <div>
                  <strong>
                    {unlocked(inspected)
                      ? equipped.has(inspected.sku)
                        ? 'Equipped'
                        : 'Owned'
                      : inspected.price === 0
                        ? 'Free'
                        : '€' + (inspected.price / 100).toFixed(2)}
                  </strong>
                  <small>
                    {unlocked(inspected)
                      ? isKnife(inspected)
                        ? 'Knife slot · Press 2 in a match'
                        : 'Gun finish'
                      : buyIntent
                        ? 'Confirm to unlock this item'
                        : 'Unlock this cosmetic for your inventory'}
                  </small>
                </div>
                {action(inspected, true)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
