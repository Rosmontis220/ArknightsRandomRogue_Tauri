<script lang="ts">
	/**
	 * 首页: the landing screen. A greeting, and a way into 生成.
	 *
	 * The hour is re-read on a timer rather than once at mount, so a window left open
	 * across noon — or across midnight with the user asleep — says the right thing when
	 * they come back to it instead of freezing on whatever it said at launch. Same reason
	 * the generate screen re-reads the date.
	 */

	import { t } from '$lib/i18n';
	import { appState } from '$lib/stores/app-state.svelte';

	/** 早上 5:00–11:59, 下午 12:00–17:59, 晚上 everything else. */
	function greetingKeyFor(hour: number): string {
		if (hour >= 5 && hour < 12) return 'home.greeting.morning';
		if (hour >= 12 && hour < 18) return 'home.greeting.afternoon';
		return 'home.greeting.evening';
	}

	let hour = $state(new Date().getHours());

	$effect(() => {
		const timer = setInterval(() => {
			hour = new Date().getHours();
		}, 60_000);
		return () => clearInterval(timer);
	});

	const name = $derived(appState.state.identity.name.trim());
	const greeting = $derived(t(greetingKeyFor(hour)));

	// Reached while the ID field is blank mid-edit, and on a document older than the default
	// ID. It is no longer the normal first-run state: an unnamed player is stored as 博士 now.
	// The branch stays because a name and an empty string are not the same thing to a
	// salutation, and "Dr." followed by nothing is not a greeting.
	const line = $derived(
		name === ''
			? t('home.greeting.anonymous', { greeting })
			: t('home.greeting.withName', { greeting, name })
	);
</script>

<section class="flex flex-col gap-4">
	<div class="card flex flex-col gap-2 px-5 py-6">
		<h2 class="greeting">{line}</h2>
		<p class="dim text-sm">{t('home.subtitle')}</p>
	</div>

	<a class="btn btn-primary" href="/home/generate">{t('nav.generate')}</a>
</section>

<style>
	.greeting {
		margin: 0;
		font-size: clamp(1.4rem, 4.2vw, 2rem);
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.01em;
	}
</style>
