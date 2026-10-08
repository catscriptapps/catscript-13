<?php
// /src/Utils/RichText.php

declare(strict_types=1);

namespace Src\Utils;

/**
 * Tiny allow-list cleaner for the rich text in invoice line items (bold,
 * italic, underline, lists, line breaks, paragraphs). Anything else is
 * unwrapped to its text; script / style / iframe … are dropped with their
 * content; every attribute is removed. Used on save AND before output, so
 * even legacy rows (which were stored unfiltered) render safely.
 */
final class RichText
{
    private const ALLOWED = ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'ul', 'ol', 'li'];
    private const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'head', 'title', 'meta', 'link', 'form', 'input', 'textarea', 'select', 'button'];

    public static function clean(string $html): string
    {
        $html = trim($html);
        if ($html === '') {
            return '';
        }
        if (!preg_match('/[<&]/', $html)) {
            return htmlspecialchars($html, ENT_QUOTES, 'UTF-8');
        }

        $doc = new \DOMDocument('1.0', 'UTF-8');
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div id="rt-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($prev);

        $root = $doc->getElementById('rt-root') ?? $doc->documentElement;
        if (!$root) {
            return htmlspecialchars(strip_tags($html), ENT_QUOTES, 'UTF-8');
        }
        self::walk($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $out .= $doc->saveHTML($child);
        }
        // Collapse runs of empty blocks left behind by pasted content
        $out = preg_replace('#(<(div|p)>\s*(<br>)?\s*</\2>\s*){2,}#i', '<br>', $out) ?? $out;
        return trim($out);
    }

    /** Plain text (for search, activity log lines, email bodies). */
    public static function text(string $html, int $max = 0): string
    {
        $text = html_entity_decode(preg_replace('#<[^>]*>#', ' ', $html) ?? $html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        return $max > 0 && mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
    }

    private static function walk(\DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof \DOMElement) {
                $tag = strtolower($child->tagName);
                if (in_array($tag, self::DROP, true)) {
                    $node->removeChild($child);
                    continue;
                }
                self::walk($child);
                if (!in_array($tag, self::ALLOWED, true)) {
                    // Unknown tag (span, font, a, img, …): keep its content, lose the tag
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);
                    continue;
                }
                while ($child->attributes->length) {
                    $child->removeAttributeNode($child->attributes->item(0));
                }
            } elseif ($child instanceof \DOMComment || $child instanceof \DOMProcessingInstruction) {
                $node->removeChild($child);
            }
        }
    }
}
