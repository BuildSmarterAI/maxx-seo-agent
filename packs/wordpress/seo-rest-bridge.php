<?php
/**
 * Plugin Name: SEO REST Bridge (Maxx Builders SEO agent)
 * Description: Exposes Yoast / Rank Math SEO meta keys via the WP REST API so the
 *   SEO agent's apply pack (packs/wordpress/apply.mjs) can read AND write them.
 *   Registers for BOTH `post` and `page` — without `page`, REST silently drops
 *   meta writes to pages (services, about, location, industries), so the pack's
 *   pages/posts routing succeeds but no-ops at the meta layer.
 * Install: drop into wp-content/mu-plugins/ (auto-loaded) or activate as a plugin.
 *
 * Version control note: this file is the source of truth for the bridge. It must
 * be installed on the WordPress host — it is not loaded by anything in this repo.
 */

if (!defined('ABSPATH')) { exit; }

add_action('init', function () {
    // Extend with any other public post types the agent needs to write meta on.
    $post_types = ['post', 'page'];

    $keys = [
        // Yoast SEO
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
        '_yoast_wpseo_canonical',
        '_yoast_wpseo_focuskw',
        // Rank Math
        'rank_math_title',
        'rank_math_description',
        'rank_math_canonical_url',
        'rank_math_focus_keyword',
    ];

    foreach ($post_types as $type) {
        foreach ($keys as $key) {
            register_post_meta($type, $key, [
                'type'          => 'string',
                'single'        => true,
                'show_in_rest'  => true,
                // Only users who can edit the content may read/write via REST.
                // The agent's Application Password user must hold this cap.
                'auth_callback' => function () {
                    return current_user_can('edit_posts');
                },
            ]);
        }
    }
});
