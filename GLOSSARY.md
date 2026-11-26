# Blue Collar MCP

Permits and inspections for small residential contractors, across many city portals, inside Claude and on a dashboard.

## Language

**Contractor**:
A small residential general contractor or trade sub who pulls **Permits** and books **Inspections** for their own jobs. The core customer. Architects who draft, submit and track permit review are a secondary fit.
_Avoid_: User, client, builder (large builders are not the target)

**Permit**:
A city's approval for a job, tracked in a **Portal**.

**Inspection**:
A city check on work under a **Permit**, which a **Contractor** requests, schedules and tracks.
_Avoid_: Appointment, visit

**Portal**:
A city's online system for **Permits** and **Inspections**. One software platform often serves many cities.
_Avoid_: Site, jurisdiction system

**Job**:
One construction project of a **Contractor**, which can span several **Permits** and cities. Permit and **Inspection** progress is how a **Job**'s overall progress is read.
_Avoid_: Project (overloaded with this software project)

**Activity feed**:
A newest-first list of what happened across a **Company**'s **Permits** and **Inspections**: booked, passed, failed, comments added, and who did it.

**Adapter**:
The code that lets Blue Collar MCP read and act in one kind of **Portal**. Built by a portal-building skill, tested repeatedly, then listed in the **Marketplace**.

**Marketplace**:
The website tab where tested **Adapters** are listed so any **Company** can add that city.

**Connection**:
A **Company**'s saved sign-in to one **Portal**, kept in its vault. The agent only ever sees a reference to it, never the password.
_Avoid_: Login, credentials (in chat)

**Seat**:
One named person (such as a project manager) on a **Company**, with their own connector link and name on the **Activity feed**. Seats share the **Company**'s **Connection**.

**Company**:
One **Contractor**'s business account, with its own profile, chosen cities and vault.
_Avoid_: Tenant, account
