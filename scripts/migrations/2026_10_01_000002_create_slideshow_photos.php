<?php
// /scripts/migrations/2026_10_01_000002_create_slideshow_photos.php
//
// The photos behind every hero slideshow and the TV screensavers (Timetable,
// Chores, Tasks…), managed from the Slideshow page (SlideshowController).
// The files stay in public/images/home/; this table holds their order and
// captions.
//
// 1. Creates slideshow_photos if it's missing (new table — legacy never reads it).
// 2. While the table is empty, brings in the photos already in
//    public/images/home/ (the numbered 1.jpg, 2.jpg… the site used until now),
//    in number order — so nothing changes on screen until someone edits it.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $log = [];

    if (!$schema->hasTable('slideshow_photos')) {
        $schema->create('slideshow_photos', function (Blueprint $table) {
            $table->increments('id');
            $table->string('file_name', 191)->unique();
            $table->string('caption', 255)->nullable();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('bytes')->nullable();
            $table->unsignedInteger('orig_user_id')->nullable();
            $table->timestamps();
        });
        $log[] = 'created slideshow_photos';
    } else {
        $log[] = 'slideshow_photos already exists — skipped';
    }

    if (Capsule::table('slideshow_photos')->count() === 0) {
        $dir = __DIR__ . '/../../public/images/home/';
        $files = is_dir($dir) ? array_values(array_filter(scandir($dir) ?: [], fn($f) => preg_match('/^\d+\.(jpe?g|png|webp|gif)$/i', $f))) : [];
        natcasesort($files);
        $now = date('Y-m-d H:i:s');
        $n = 0;
        foreach ($files as $file) {
            $size = @getimagesize($dir . $file) ?: [null, null];
            Capsule::table('slideshow_photos')->insert([
                'file_name'  => $file,
                'sort_order' => ++$n,
                'width'      => $size[0],
                'height'     => $size[1],
                'bytes'      => @filesize($dir . $file) ?: null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        $log[] = $n ? "brought in the {$n} photos already in images/home/" : 'no existing photos in images/home/ to bring in';
    } else {
        $log[] = 'slideshow already has photos — skipped';
    }

    return $log;
};
