// packs/wordpress/seo-keys.mjs — the yoast/rankmath SEO meta-key map. Shared by the apply
// pack (writes meta) and scripts/cms-read.mjs (reads base_value) so the field→meta-key
// mapping cannot drift between the read and write sides.
export const SEO_KEYS = {
  yoast:    { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc",
              canonical: "_yoast_wpseo_canonical", focus: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title", description: "rank_math_description",
              canonical: "rank_math_canonical_url", focus: "rank_math_focus_keyword" },
};

// The key map for the active plugin (SEO_PLUGIN env, default yoast).
export const keysFor = (plugin = process.env.SEO_PLUGIN || "yoast") => SEO_KEYS[plugin.toLowerCase()];
