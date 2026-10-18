# TODO

What's left before and after launch. What's already built is in README.md.

## Loose ends from setup (2026-10-18)

- [ ] **Test Save and Publish once.** Change one small thing on a piece at https://www.postmarkarchive.com/admin, then **Save** and **Publish**. Check the change appears on the live site, then change it back.
- [ ] **Delete the temporary Supabase token** at https://supabase.com/dashboard/account/tokens. It's still active.
- [ ] **Anthropic key:** check that `ANTHROPIC_API_KEY` is set in Vercel, then try **Suggest shorter titles** once on a piece with a long title.
- [ ] **Developer:** point the local git remote at `devnobots/postmark-archive`. The old name still works through a redirect.

## Selling: checkout (Stripe)

The cart buttons (カートに入れる on desktop, 購入する on phone) don't do anything yet.

- [ ] **Stripe account** for the shop, in Japanese yen.
- [ ] **Stripe Checkout** for one piece at a time. Each piece is one of a kind, so:
  - [ ] hold the piece while someone is paying, so two people can't buy it at once;
  - [ ] when payment succeeds, mark the piece sold automatically and republish the site;
  - [ ] release the hold if the payment is abandoned.
- [ ] **Buyer details:** shipping address in Japan, email, and an optional Instagram handle for the CONSIGNEE line (blank means PRIVATE COLLECTION).
- [ ] **Order emails** to the buyer (receipt, then shipping notice) and to the shop.
- [ ] **Orders in the back office:** a list of orders with payment status, address, and a "shipped" mark with tracking number.
- [ ] **Refunds:** decide the policy, and how a refunded piece goes back on sale.

## Shipping and customs (decisions needed)

- [ ] Carrier and service from the US to Japan, and the typical cost per category. Prices already say 送料込み (shipping included).
- [ ] Who pays Japanese import tax and duties: the shop (included in the price) or the buyer on delivery.
- [ ] Packaging and insurance for higher-priced pieces.

## Japanese legal pages and policies

- [ ] 特定商取引法に基づく表記 (the seller information page Japanese law requires for online shops).
- [ ] Privacy policy (プライバシーポリシー).
- [ ] Returns and exchanges policy (返品・交換).
- [ ] Links to these pages in the site footer, desktop and phone.

## Content before launch

- [ ] Japanese titles checked by a native speaker.
- [ ] The jeans are blue but titled ブラックデニム / "Faded Black Denim". Fix the title.
- [ ] Remove the test data:
  - [ ] the socks are marked sold to the sample handle `aoi.knits`;
  - [ ] some prices are placeholders;
  - [ ] past drops 9–11 are sample drops.
- [ ] Real photos for every piece. Full resolution is fine; the back office makes the web copies.
- [ ] Release date and pieces for the first real drop.

## Launch

- [ ] **The access code (`1234`):** remove it, or change it if the site should stay private for a while. The past-drops page (`drops.html`) has no access code at all.
- [ ] **Link previews:** a share image and description for when the site is posted on Instagram, LINE or X. Also check the favicon.
- [ ] **Instagram:** the shop's own account, linked from the site.

## Later

- [ ] Visitor analytics.
- [ ] Database backups: check what the Supabase plan includes.
- [ ] A way to sign up for new-drop announcements (email or LINE).
- [ ] Clean up the old one-time tools in `tools/` (the `apply_*.py` files and `set_demo_prices.py`).
- [ ] Optional: rename the internal `package.json` names from `standard-gauge`.
