#pragma once

#include <memory>

namespace saucer
{
    class application;
    class window;
} // namespace saucer

class SystemTray
{
  public:
    struct Impl;

  private:
    std::unique_ptr<Impl> m_impl;

  public:
    SystemTray(saucer::application *app, saucer::window &window);
    ~SystemTray();

    SystemTray(SystemTray &&) noexcept;
    SystemTray &operator=(SystemTray &&) noexcept;

    /// Switch tray icon between B&W (inactive) and accent-coloured (active/playing).
    void set_active(bool active);
};
