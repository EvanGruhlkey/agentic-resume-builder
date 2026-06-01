from __future__ import annotations

import contextlib
import random
from typing import AsyncIterator

from playwright.async_api import async_playwright

from utils.helpers import config_get, random_delay


class BrowserPool:
    def __init__(self, config: dict):
        self.config = config
        self.playwright = None
        self.browser = None
        self.navigation_timeout_ms = int(config_get(config, "browser.navigation_timeout_ms", 30000))

    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        launch_args = {
            "headless": bool(config_get(self.config, "browser.headless", True)),
            "slow_mo": int(config_get(self.config, "browser.slow_mo_ms", 0)),
        }
        proxy = self._proxy_config()
        if proxy:
            launch_args["proxy"] = proxy
        self.browser = await self.playwright.chromium.launch(**launch_args)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    @contextlib.asynccontextmanager
    async def page(self, platform: str) -> AsyncIterator:
        user_agent = random.choice(config_get(self.config, "browser.user_agents", []) or [None])
        context = await self.browser.new_context(
            user_agent=user_agent,
            viewport={"width": random.randint(1220, 1440), "height": random.randint(820, 980)},
            locale="en-US",
        )
        page = await context.new_page()
        page.set_default_navigation_timeout(self.navigation_timeout_ms)
        page.set_default_timeout(self.navigation_timeout_ms)
        try:
            yield page
        finally:
            await context.close()

    async def settle(self, page) -> None:
        await page.wait_for_load_state("domcontentloaded")
        with contextlib.suppress(Exception):
            await page.wait_for_load_state("networkidle", timeout=6000)
        await random_delay(
            float(config_get(self.config, "browser.min_delay_seconds", 1.2)),
            float(config_get(self.config, "browser.max_delay_seconds", 4.5)),
        )

    async def human_scroll(self, page) -> None:
        steps = random.randint(3, 7)
        for _ in range(steps):
            await page.mouse.wheel(0, random.randint(350, 900))
            await random_delay(0.15, 0.65)

    def _proxy_config(self) -> dict | None:
        if not config_get(self.config, "browser.proxy.enabled", False):
            return None
        server = config_get(self.config, "browser.proxy.server")
        if not server:
            return None
        proxy = {"server": server}
        username = config_get(self.config, "browser.proxy.username")
        password = config_get(self.config, "browser.proxy.password")
        if username:
            proxy["username"] = username
        if password:
            proxy["password"] = password
        return proxy
