import React from 'react';
import {
    Package,
    Calculator,
    Tags,
    Globe,
    ShoppingBag,
    Archive,
    Truck,
    MessageCircle,
    TrendingUp,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';

export const TABS = [
    { id: 'DS_SP', label: 'DS SP', icon: Package },
    { id: 'TINH_GIA', label: 'TÍNH GIÁ', icon: Calculator },
    { id: 'SP_GIAM_GIA', label: 'SP GIẢM GIÁ', icon: Tags },
    { id: 'WEB_SP', label: 'WEB SP', icon: Globe },
    { id: 'DH', label: 'ĐH', icon: ShoppingBag },
    { id: 'CHO_LAY_HANG', label: 'CHỜ LẤY HÀNG', icon: Truck },
    { id: 'AUTO_CHAT', label: 'AUTO CHAT', icon: MessageCircle },
    { id: 'THI_TRUONG', label: 'THỊ TRƯỜNG', icon: TrendingUp }
];

export default function Sidebar({
    currentTab,
    onTabChange,
    collapsed,
    onToggleCollapse
}) {
    return (
        <aside className="sidebar" id="sidebar">
            <div className="sidebar-header">
                <div className="brand">
                    <div
                        className="logo"
                        style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            lineHeight: 1.2,
                            textAlign: 'center'
                        }}
                    >
                        INFO<br />SYS
                    </div>
                    <h1 id="pageTitle" style={{ display: collapsed ? 'none' : 'block' }}>
                        Hệ thống
                    </h1>
                </div>
                <button
                    className="sidebar-toggle"
                    type="button"
                    onClick={onToggleCollapse}
                    title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                >
                    {collapsed ? (
                        <PanelLeftOpen style={{ width: 18, height: 18 }} />
                    ) : (
                        <PanelLeftClose style={{ width: 18, height: 18 }} />
                    )}
                </button>
            </div>

            <div className="tabs">
                {TABS.map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = currentTab === tab.id;
                    return (
                        <div
                            key={tab.id}
                            className={`tab ${isActive ? 'active' : ''}`}
                            data-tab={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            title={collapsed ? tab.label : ''}
                        >
                            <IconComponent style={{ width: 18, height: 18, flexShrink: 0 }} />
                            {!collapsed && <span>{tab.label}</span>}
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a
                    href="https://banhang.shopee.vn"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#ee4d2d',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        boxShadow: '0 2px 4px rgba(238, 77, 45, 0.3)'
                    }}
                    title="Mở Kênh Người Bán Shopee (Chạy Extension)"
                >
                    <span style={{ fontSize: '15px' }}>🛒</span>
                    {!collapsed && <span>Shopee Kênh Bán</span>}
                </a>
            </div>
        </aside>
    );
}
