#pragma once

#include <memory>

namespace saucer
{
    class application;
    class window;
} // namespace saucer

class SystemTray
{
    struct Impl;
    std::unique_ptr<Impl> m_impl;

  public:
    SystemTray(saucer::application *app, saucer::window &window);
    ~SystemTray();

    SystemTray(SystemTray &&) noexcept;
    SystemTray &operator=(SystemTray &&) noexcept;
};
