```mermaid

---
title: show Landmark info list on scroll screen
---

sequenceDiagram
landmark.json->>LandmarkViewModel:Read landmark info
LandmarkViewModel->>LandmarkList: Column Landmark's info list
LandmarkList->>MainActivity: show scrollable landmark list

```