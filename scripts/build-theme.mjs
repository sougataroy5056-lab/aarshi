// Builds a Shopify theme from the pre-rendered site in public/ (run `npm run build` first).
// Output: shopify-theme/ (theme files) and public/theme/ars-shi-theme.zip (for upload).
//
// The layout carries the whole storefront. Shopify templates only tell the page which
// view to open first (product, collection, cart...) and render real Shopify content
// for pages, search, blogs and customer accounts.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from "node:fs";
import { zipSync } from "fflate";

const OUT = "shopify-theme";
const built = readFileSync("public/index.html", "utf8");
const headInner = built.slice(built.indexOf("<head>") + 6, built.indexOf("</head>"));
let bodyInner = built.slice(built.indexOf("<body>") + 6, built.lastIndexOf("</body>"));

// every asset lives in the theme's flat assets/ folder on Shopify's CDN
const toAssets = s => s
  .replace(/(["'(\s])\/?img\/w\//g, "$1{{ asset_base }}")
  .replace(/(["'(\s])\/?fonts\//g, "$1{{ asset_base }}");

let head = toAssets(headInner)
  .replace(/<title>[^<]*<\/title>/, "<title>{% if template.name == 'index' %}ARS SHI Parfums{% else %}{{ page_title }} · ARS SHI Parfums{% endif %}</title>")
  .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="{{ page_description | default: \'ARS SHI Parfums: six Eaux de Parfum in textured, foil-pressed boxes. 50 ml, ₹899 each.\' | escape }}">')
  .replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="https:{{ \'stage-wide.webp\' | asset_url }}">')
  .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="{{ page_title | escape }}">')
  .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="{{ page_description | default: shop.description | escape }}">');

bodyInner = toAssets(bodyInner)
  // the home view is only open by default on the home page
  .replace('class="view on" id="v-home"', `class="view{% if template.name == 'index' %} on{% endif %}" id="v-home"`);

// Shopify data for the page script, placed before the storefront markup
const shopData = `<script>
window.SHOP = {
  route: {{ ars_route | json }},
  openBag: {% if template.name == 'cart' %}true{% else %}false{% endif %},
  cart: {{ cart | json }},
  products: {
    {%- for p in collections.all.products -%}
    {{ p.handle | json }}: {"v": {{ p.selected_or_first_available_variant.id }}, "price": {{ p.price }}, "ok": {{ p.available }}}{% unless forloop.last %},{% endunless %}
    {%- endfor -%}
  }
};
</script>`;

// content_for_layout: real Shopify content (pages, search, accounts). Hidden when a storefront view is open.
const sc = `<div id="shopify-content" class="wrap help shopify-content">{{ content_for_layout }}</div>`;
bodyInner = bodyInner.replace('</main>', '</main>\n' + sc);

const layout = `<!doctype html>
<html lang="{{ request.locale.iso_code | default: 'en' }}">
<head>
{%- liquid
  assign asset_base = 'stage-wide.webp' | asset_url | split: 'stage-wide.webp' | first
  case template.name
    when 'product'
      assign ars_route = product.handle
    when 'collection' or 'list-collections'
      assign ars_route = 'shop'
    when 'cart'
      assign ars_route = 'shop'
    when 'index'
      assign ars_route = ''
    else
      assign ars_route = 'page'
  endcase
-%}
${head}
<style>
.shopify-content{padding-block:clamp(32px,6vw,80px)}
.shopify-content h1{font-size:clamp(34px,5vw,60px);line-height:1.05;margin-bottom:18px}
.shopify-content .rte{color:var(--muted);font-size:16px;max-width:65ch}
.shopify-content .rte a{text-decoration:underline}
.shopify-content form{display:flex;flex-direction:column;gap:12px;max-width:420px;margin-top:18px}
.shopify-content input[type=email],.shopify-content input[type=password],.shopify-content input[type=text],.shopify-content input[type=search]{min-height:48px;border:1px solid var(--line);padding:0 14px;font:inherit;font-size:16px;background:var(--stone);color:var(--ink)}
.shopify-content .errors{color:#a1262b}
.shopify-content .sres{max-height:none}
</style>
{{ content_for_header }}
</head>
<body>
${shopData}
${bodyInner}
</body>
</html>
`;

const T = {};
T["templates/index.liquid"] = `{%- comment -%}The home page is rendered by layout/theme.liquid.{%- endcomment -%}`;
T["templates/product.liquid"] = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | json }},
  "brand": {"@type": "Brand", "name": "ARS SHI"},
  "image": {{ product.featured_image | image_url: width: 1200 | prepend: 'https:' | json }},
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  "offers": {"@type": "Offer", "priceCurrency": {{ cart.currency.iso_code | json }}, "price": {{ product.price | divided_by: 100.0 | json }}, "availability": "https://schema.org/{% if product.available %}InStock{% else %}OutOfStock{% endif %}", "url": {{ shop.url | append: product.url | json }}}
}
</script>`;
T["templates/collection.liquid"] = `{%- comment -%}Collections open the storefront's shop view.{%- endcomment -%}`;
T["templates/list-collections.liquid"] = T["templates/collection.liquid"];
T["templates/cart.liquid"] = `{%- comment -%}The cart opens the storefront's bag drawer.{%- endcomment -%}`;
T["templates/page.liquid"] = `<h1>{{ page.title }}</h1>\n<div class="rte">{{ page.content }}</div>`;
T["templates/page.contact.liquid"] = `<h1>{{ page.title }}</h1>
<div class="rte">{{ page.content }}</div>
{%- form 'contact' -%}
  {%- if form.posted_successfully? -%}<p>Thank you. We'll reply within one working day.</p>{%- endif -%}
  {{ form.errors | default_errors }}
  <label for="c-name">Name</label><input id="c-name" type="text" name="contact[name]" autocomplete="name">
  <label for="c-email">Email</label><input id="c-email" type="email" name="contact[email]" required autocomplete="email">
  <label for="c-msg">Message</label><textarea id="c-msg" name="contact[body]" rows="5" style="border:1px solid var(--line);padding:12px;font:inherit"></textarea>
  <button class="btn" type="submit">Send</button>
{%- endform -%}`;
T["templates/search.liquid"] = `<h1>Search</h1>
<form action="{{ routes.search_url }}" method="get" role="search"><label for="s" class="sr">Search</label><input id="s" type="search" name="q" value="{{ search.terms | escape }}" placeholder="Search fragrances"><button class="btn" type="submit">Search</button></form>
{%- if search.performed -%}
  <p class="rte">{{ search.results_count }} result{% if search.results_count != 1 %}s{% endif %} for “{{ search.terms | escape }}”.</p>
  <div class="sres">{%- for item in search.results -%}<a href="{{ item.url }}"><span>{{ item.title }}</span></a>{%- endfor -%}</div>
{%- endif -%}`;
T["templates/404.liquid"] = `<h1>Page not found</h1><div class="rte"><p>The page you were looking for isn't here. <a href="{{ routes.root_url }}">Return to the collection</a>.</p></div>`;
T["templates/blog.liquid"] = `<h1>{{ blog.title }}</h1>{%- paginate blog.articles by 12 -%}{%- for article in blog.articles -%}<p class="rte"><a href="{{ article.url }}">{{ article.title }}</a> · {{ article.published_at | date: '%d %b %Y' }}</p>{%- endfor -%}{%- endpaginate -%}`;
T["templates/article.liquid"] = `<h1>{{ article.title }}</h1><div class="rte">{{ article.content }}</div>`;
T["templates/gift_card.liquid"] = `{%- layout none -%}<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gift card · ARS SHI</title>{{ content_for_header }}</head><body style="font-family:'Palatino Linotype',Palatino,serif;padding:32px;color:#0E1B36"><h1>ARS SHI gift card</h1><p>{{ gift_card.balance | money }} remaining</p><p>Code: <strong>{{ gift_card.code | format_code }}</strong></p></body></html>`;
T["templates/password.liquid"] = `<div style="max-width:420px;margin:12vh auto;padding:0 16px;text-align:center">
  <p style="letter-spacing:.32em;font-size:26px">ARS SHI</p><p style="color:#4F607C">{{ shop.password_message | default: 'Opening soon.' }}</p>
  {%- form 'storefront_password' -%}{{ form.errors | default_errors }}
    <label for="pw" style="position:absolute;left:-9999px">Password</label>
    <input id="pw" type="password" name="password" placeholder="Store password" style="min-height:48px;width:100%;border:1px solid rgba(14,27,54,.2);padding:0 14px;font:inherit;font-size:16px">
    <button type="submit" style="margin-top:12px;min-height:52px;width:100%;background:#0E1B36;color:#fff;border:0;letter-spacing:.2em;text-transform:uppercase;font:inherit">Enter</button>
  {%- endform -%}</div>`;
T["layout/password.liquid"] = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARS SHI Parfums</title>{{ content_for_header }}</head><body style="margin:0;font-family:'Palatino Linotype',Palatino,'Book Antiqua',serif;color:#0E1B36;background:#fff">{{ content_for_layout }}</body></html>`;
// classic customer accounts (stores on new customer accounts never use these)
T["templates/customers/login.liquid"] = `<h1>Sign in</h1>{%- form 'customer_login' -%}{{ form.errors | default_errors }}<label for="l-e">Email</label><input id="l-e" type="email" name="customer[email]" autocomplete="email"><label for="l-p">Password</label><input id="l-p" type="password" name="customer[password]" autocomplete="current-password"><button class="btn" type="submit">Sign in</button><a class="link" href="{{ routes.account_register_url }}">Create an account</a>{%- endform -%}`;
T["templates/customers/register.liquid"] = `<h1>Create an account</h1>{%- form 'create_customer' -%}{{ form.errors | default_errors }}<label for="r-f">First name</label><input id="r-f" type="text" name="customer[first_name]"><label for="r-e">Email</label><input id="r-e" type="email" name="customer[email]" autocomplete="email"><label for="r-p">Password</label><input id="r-p" type="password" name="customer[password]" autocomplete="new-password"><button class="btn" type="submit">Create account</button>{%- endform -%}`;
T["templates/customers/account.liquid"] = `<h1>Your account</h1><div class="rte"><p>{{ customer.first_name }} {{ customer.last_name }} · {{ customer.email }}</p>{%- if customer.orders.size > 0 -%}<ul>{%- for order in customer.orders -%}<li><a href="{{ order.customer_url }}">{{ order.name }}</a> · {{ order.created_at | date: '%d %b %Y' }} · {{ order.total_price | money }} · {{ order.fulfillment_status_label }}</li>{%- endfor -%}</ul>{%- else -%}<p>No orders yet.</p>{%- endif -%}<p><a href="{{ routes.account_logout_url }}">Sign out</a></p></div>`;
T["templates/customers/order.liquid"] = `<h1>Order {{ order.name }}</h1><div class="rte">{%- for li in order.line_items -%}<p>{{ li.title }} × {{ li.quantity }} · {{ li.final_line_price | money }}</p>{%- endfor -%}<p>Total {{ order.total_price | money }}</p></div>`;
T["templates/customers/addresses.liquid"] = `<h1>Addresses</h1><div class="rte">{%- for address in customer.addresses -%}<p>{{ address | format_address }}</p>{%- endfor -%}</div>`;
T["templates/customers/activate_account.liquid"] = `<h1>Activate your account</h1>{%- form 'activate_customer_password' -%}{{ form.errors | default_errors }}<label for="a-p">Password</label><input id="a-p" type="password" name="customer[password]"><label for="a-c">Confirm password</label><input id="a-c" type="password" name="customer[password_confirmation]"><button class="btn" type="submit">Activate</button>{%- endform -%}`;
T["templates/customers/reset_password.liquid"] = `<h1>Reset password</h1>{%- form 'reset_customer_password' -%}{{ form.errors | default_errors }}<label for="rp-p">New password</label><input id="rp-p" type="password" name="customer[password]"><label for="rp-c">Confirm password</label><input id="rp-c" type="password" name="customer[password_confirmation]"><button class="btn" type="submit">Reset</button>{%- endform -%}`;
T["config/settings_schema.json"] = JSON.stringify([{ name: "theme_info", theme_name: "ARS SHI", theme_version: "1.0.0", theme_author: "ARS SHI Parfums", theme_documentation_url: "https://ars-shi.vercel.app", theme_support_url: "https://ars-shi.vercel.app" }], null, 2);
T["config/settings_data.json"] = JSON.stringify({ current: {} }, null, 2);
T["locales/en.default.json"] = JSON.stringify({ general: { password_page: { login_form_password_label: "Password" } } }, null, 2);
T["layout/theme.liquid"] = layout;

rmSync(OUT, { recursive: true, force: true });
for (const [path, content] of Object.entries(T)) {
  mkdirSync(`${OUT}/${path.split("/").slice(0, -1).join("/")}`, { recursive: true });
  writeFileSync(`${OUT}/${path}`, content);
}
mkdirSync(`${OUT}/assets`, { recursive: true });
for (const f of readdirSync("site/img/w")) cpSync(`site/img/w/${f}`, `${OUT}/assets/${f}`);
for (const f of readdirSync("site/fonts")) cpSync(`site/fonts/${f}`, `${OUT}/assets/${f}`);

mkdirSync("public/theme", { recursive: true });
rmSync("public/theme/ars-shi-theme.zip", { force: true });
const files = {};
const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; e.isDirectory() ? walk(p) : (files[p.slice(OUT.length + 1)] = new Uint8Array(readFileSync(p))); } };
walk(OUT);
writeFileSync("public/theme/ars-shi-theme.zip", zipSync(files, { level: 6 }));
console.log(`Theme: ${Object.keys(T).length} files + ${readdirSync(`${OUT}/assets`).length} assets → public/theme/ars-shi-theme.zip`);
